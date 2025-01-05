  const mongoose = require('mongoose');

  const BookingSchema = new mongoose.Schema({
    name: {
      type: String,
      required: true,
    },
    vehicleType: {
      type: String,
      required: true,
    },
    address: {
      type: String,
      required: false,
    },
    phoneNumber: {
      type: String, // Use String instead of Number to allow any format
      required: true,
    },
    
    createdAt: {
      type: Date,
      default: Date.now,
    },
    
    tourDate: {
      type: Date,
      required: true,
    },
    
    tourTime: {
      type: String,
      required: false,
    },
    tour: {
      type: String,
      required: true
    },
    specialRequirements: {
      type: String,
      default: 'No',
      required: false
    },
    totalPassengers: {
      type: Number,
      required: false
      
    }
  });

  const Booking = mongoose.model('Booking', BookingSchema);

  module.exports = Booking;
