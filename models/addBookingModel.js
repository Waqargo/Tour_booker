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
      type: String,
      required: true,
      validate: {
          validator: function(v) {
              return /^\+?[1-9]\d{1,14}$/.test(v); // Regex for international phone numbers
          },
          message: props => `${props.value} is not a valid phone number! Please include the country code.`
      }
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
