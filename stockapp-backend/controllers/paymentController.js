// controllers/paymentController.js
const mongoose = require('mongoose');
const Payment = require('../models/Payment');
const Sale = require('../models/Sale');
const Customer = require('../models/Customer');
const { today, parseDay } = require('../utils/businessDate');
const { round2, OPEN_BILL_MATCH, refreshStatus } = require('../utils/billing');

const fail = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

// Builds the cheque part of a payment; also used for cheques taken at the time of sale.
exports.chequeFields = ({ chequeNumber, bankName, chequeDate }) => {
  if (!chequeNumber || !bankName || !chequeDate) {
    throw fail('Cheque number, bank name and cheque date are required.', 400);
  }
  return { chequeNumber, bankName, chequeDate: parseDay(chequeDate), chequeStatus: 'pending' };
};

const translateDuplicate = (error) =>
  (error.code === 11000 ? fail('This cheque number is already recorded for this bank.', 409) : error);

// Collect cash or a cheque from a customer. Settles the given bill, or the oldest due bills first.
exports.recordPayment = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { customerId, saleId, method } = req.body;
    const amount = round2(Number(req.body.amount));
    if (!customerId || !['cash', 'cheque'].includes(method) || !(amount > 0)) {
      throw fail('Customer, payment method (cash or cheque) and a positive amount are required.', 400);
    }
    const cheque = method === 'cheque' ? exports.chequeFields(req.body) : {};

    if (!(await Customer.findById(customerId).session(session))) throw fail('Customer not found.', 404);

    const filter = { ...OPEN_BILL_MATCH, customer: customerId, ...(saleId && { _id: saleId }) };
    const bills = await Sale.find(filter).sort({ dueDate: 1, createdAt: 1 }).session(session);
    const owed = round2(bills.reduce((sum, bill) => sum + (bill.balanceDue ?? bill.totalAmount), 0));
    if (amount > owed) throw fail(`Amount is more than the open balance of ${owed.toFixed(2)}.`, 400);

    const allocations = [];
    let remaining = amount;
    for (const bill of bills) {
      if (remaining <= 0) break;
      const balance = bill.balanceDue ?? bill.totalAmount;
      const applied = round2(Math.min(balance, remaining));
      bill.balanceDue = balance - applied;
      if (method === 'cash') bill.amountPaid += applied;
      else bill.pendingChequeAmount += applied;
      refreshStatus(bill);
      await bill.save({ session });
      allocations.push({ sale: bill._id, amount: applied });
      remaining = round2(remaining - applied);
    }

    const [payment] = await Payment.create([{
      customer: customerId, method, amount, allocations, ...cheque,
    }], { session });

    await session.commitTransaction();
    res.status(201).json({ success: true, data: payment });
  } catch (error) {
    await session.abortTransaction();
    next(translateDuplicate(error));
  } finally {
    session.endSession();
  }
};

// Cheques grouped by what needs doing today.
exports.getChequeTracker = async (req, res, next) => {
  try {
    const cheques = await Payment.find({ method: 'cheque' })
      .populate('customer', 'name phone')
      .sort({ chequeDate: 1 })
      .lean();
    const day = today().getTime();
    const tracker = { missed: [], dueToday: [], upcoming: [], deposited: [], bounced: [], cleared: [] };
    for (const cheque of cheques) {
      if (cheque.chequeStatus !== 'pending') tracker[cheque.chequeStatus].push(cheque);
      else if (cheque.chequeDate.getTime() < day) tracker.missed.push(cheque);
      else if (cheque.chequeDate.getTime() === day) tracker.dueToday.push(cheque);
      else tracker.upcoming.push(cheque);
    }
    res.status(200).json({ success: true, data: tracker });
  } catch (error) {
    next(error);
  }
};

const TRANSITIONS = { pending: ['deposited'], deposited: ['cleared', 'bounced'], cleared: [], bounced: [] };

// Move a cheque through pending -> deposited -> cleared or bounced.
exports.updateChequeStatus = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { status, reason } = req.body;
    const cheque = await Payment.findOne({ _id: req.params.paymentId, method: 'cheque' }).session(session);
    if (!cheque) throw fail('Cheque not found.', 404);
    if (!TRANSITIONS[cheque.chequeStatus].includes(status)) {
      throw fail(`A ${cheque.chequeStatus} cheque cannot be marked ${status}.`, 409);
    }

    const now = new Date();
    if (status === 'deposited') {
      if (cheque.chequeDate > today()) {
        throw fail(`This cheque cannot be deposited before ${cheque.chequeDate.toISOString().slice(0, 10)}.`, 400);
      }
      cheque.depositedAt = now;
    } else {
      // The money is now certain: it either moves to paid or goes back to being owed.
      for (const { sale: saleId, amount } of cheque.allocations) {
        const bill = await Sale.findById(saleId).session(session);
        bill.pendingChequeAmount -= amount;
        if (status === 'cleared') bill.amountPaid += amount;
        else bill.balanceDue += amount;
        refreshStatus(bill);
        await bill.save({ session });
      }
      if (status === 'cleared') cheque.clearedAt = now;
      else {
        cheque.bouncedAt = now;
        cheque.bounceReason = reason;
      }
    }
    cheque.chequeStatus = status;
    await cheque.save({ session });

    await session.commitTransaction();
    res.status(200).json({ success: true, data: cheque });
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
};
