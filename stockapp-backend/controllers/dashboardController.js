// controllers/dashboardController.js
const Sale = require('../models/Sale');
const Customer = require('../models/Customer');
const InventoryItem = require('../models/InventoryItem');
const mongoose = require('mongoose');
const { OPEN_BILL_MATCH, BALANCE_EXPR } = require('../utils/billing');

exports.getSalesData = async (req, res, next) => {
    try {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1); startOfMonth.setHours(0, 0, 0, 0);
        const startOfYesterday = new Date(today); startOfYesterday.setDate(today.getDate() - 1); startOfYesterday.setHours(0, 0, 0, 0);
        const startOfToday = new Date(today); startOfToday.setHours(0, 0, 0, 0);
        const endOfToday = new Date(today); endOfToday.setHours(23, 59, 59, 999);

        // Daily Sales (Today)
        const dailySales = await Sale.aggregate([
            { $match: { createdAt: { $gte: startOfToday, $lte: new Date() } } },
            { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, totalSales: { $sum: "$totalAmount" }, count: { $sum: 1 } } },
            { $sort: { _id: 1 } }
        ]);

        // Monthly Sales (Current Month)
        const monthlySales = await Sale.aggregate([
            { $match: { createdAt: { $gte: startOfMonth, $lte: new Date() } } },
            { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } }, totalSales: { $sum: "$totalAmount" }, count: { $sum: 1 } } },
            { $sort: { _id: 1 } }
        ]);

        // Inventory Summary
        const inventorySummary = await InventoryItem.aggregate([
            { $group: { _id: null, totalStockValue: { $sum: { $multiply: ["$price", "$quantity"] } }, totalItemsCount: { $sum: "$quantity" }, numberOfProductTypes: { $sum: 1 } } }
        ]);

        // Credit Customers Summary
        const creditCustomersSummary = await Sale.aggregate([
            { $match: { ...OPEN_BILL_MATCH, dueDate: { $gte: new Date() } } },
            { $lookup: { from: 'customers', localField: 'customer', foreignField: '_id', as: 'customerInfo' } },
            { $unwind: '$customerInfo' },
            { $group: {
                _id: '$customerInfo._id',
                customerName: { $first: '$customerInfo.name' },
                totalAmountOwed: { $sum: BALANCE_EXPR },
                latestDueDate: { $max: '$dueDate' },
                billCount: { $sum: 1 }
            }},
            { $sort: { latestDueDate: 1 } }
        ]);

        res.status(200).json({
            success: true,
            data: {
                salesSummary: {
                    daily: dailySales,
                    monthly: monthlySales,
                    inventory: inventorySummary.length > 0 ? inventorySummary[0] : { totalStockValue: 0, totalItemsCount: 0, numberOfProductTypes: 0 },
                    creditCustomers: creditCustomersSummary
                }
            }
        });
    } catch (error) {
        next(error);
    }
};

exports.getCreditCustomersSummary = async (req, res, next) => {
    try {
        const creditCustomersSummary = await Sale.aggregate([
            { $match: OPEN_BILL_MATCH }, // All bills still owed
            { $lookup: { from: 'customers', localField: 'customer', foreignField: '_id', as: 'customerInfo' } },
            { $unwind: '$customerInfo' },
            { $group: {
                _id: '$customerInfo._id',
                customerName: { $first: '$customerInfo.name' },
                totalAmountOwed: { $sum: BALANCE_EXPR },
                latestDueDate: { $max: '$dueDate' },
                billCount: { $sum: 1 }
            }},
            { $sort: { totalAmountOwed: -1 } } // Sort by highest debt first
        ]);

        res.status(200).json({
            success: true,
            data: creditCustomersSummary
        });
    } catch (error) {
        next(error);
    }
};

exports.getDueAndOverdueBills = async (req, res, next) => {
    try {
        const now = new Date();
        now.setHours(0, 0, 0, 0);

        // Get due bills (not yet overdue)
        const dueBills = await Sale.aggregate([
            { $match: { ...OPEN_BILL_MATCH, dueDate: { $gte: now } } },
            { $lookup: { from: 'customers', localField: 'customer', foreignField: '_id', as: 'customerInfo' } },
            { $unwind: '$customerInfo' },
            { $project: {
                _id: 1,
                customerId: '$customer',
                customerName: '$customerInfo.name',
                totalAmount: 1,
                balanceDue: BALANCE_EXPR,
                dueDate: 1,
                createdAt: 1
            }},
            { $sort: { dueDate: 1 } }
        ]);

        // Get overdue bills
        const overdueBills = await Sale.aggregate([
            { $match: { ...OPEN_BILL_MATCH, dueDate: { $lt: now } } },
            { $lookup: { from: 'customers', localField: 'customer', foreignField: '_id', as: 'customerInfo' } },
            { $unwind: '$customerInfo' },
            { $project: {
                _id: 1,
                customerId: '$customer',
                customerName: '$customerInfo.name',
                totalAmount: 1,
                balanceDue: BALANCE_EXPR,
                dueDate: 1,
                createdAt: 1
            }},
            { $sort: { dueDate: 1 } }
        ]);

        res.status(200).json({
            success: true,
            data: {
                dueBills,
                overdueBills
            }
        });
    } catch (error) {
        next(error);
    }
};