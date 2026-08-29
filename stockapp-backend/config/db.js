const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    // Removed useNewUrlParser and useUnifiedTopology as they are deprecated
    const conn = await mongoose.connect(process.env.MONGODB_URI); 

    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    // Exit process with failure
    process.exit(1);
  }
};

module.exports = connectDB;