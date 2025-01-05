const express = require("express");
const createHttpError = require("http-errors");
const morgan = require("morgan");
const mongoose = require("mongoose");
require("dotenv").config();
const connectFlash = require("connect-flash");
const session = require("express-session");
const passport = require("passport");
const connectMongo = require("connect-mongo");
const connectEnsureLogin = require("connect-ensure-login");
const User = require('./models/userModel');
const Booking = require('./models/addBookingModel');
const ExcelJS = require('exceljs');

const app = express();

// Middleware
app.use(morgan("dev"));
app.set("view engine", "ejs");
app.use(express.static(__dirname + "/public"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

const MongoStore = connectMongo.create({
  mongoUrl: process.env.MONGO_URI,
  mongooseConnection: mongoose.connection,
});

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
    },
    store: MongoStore,
  })
);

app.use(passport.initialize());
app.use(passport.session());
require("./utils/passport_auth");

app.use((req, res, next) => {
  res.locals.user = req.user;
  next();
});

app.use(connectFlash());
app.use((req, res, next) => {
  res.locals.messages = req.flash();
  next();
});

function isAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  req.flash('error', 'Please log in to view this page');
  res.redirect('/login');
}

const authRole = (role) => {
  return (req, res, next) => {
    if (req.user && req.user.role == role) {
      next();
    } else {
      req.flash('error', 'Unauthorized access');
      res.status(403).send('Unauthorized')
      res.redirect('/');
    }
  };
};

app.get('/users', isAuthenticated, authRole("admin"), async (req, res, next) => {
  try {
    const users = await User.find();
    res.render('manage_users', { users });
  } catch (error) {
    next(error);
  }
});

app.get('/user/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      req.flash('error', 'Invalid ID');
      res.redirect('/users');
      return;
    }
    const person = await User.findById(id);
    if (!person) {
      req.flash('error', 'User not found');
      res.redirect('/users');
      return;
    }
    res.render('profile', { person });
  } catch (error) {
    next(error);
  }
});

app.post('/register', async (req, res, next) => {
  try {
    const { name, email, password, phone, address } = req.body;
    const user = new User({ name, email, password, phone, address });
    await user.save();
    req.flash('success', 'Registration successful! Please log in.');
    res.redirect('/login');
  } catch (error) {
    req.flash('error', error.message);
    res.redirect('/register');
  }
});

// Assuming this is your route handling code for updating the user's role
app.post('/update-role', async (req, res, next) => {
  try {
    const { id, role } = req.body;
    const { roles } = require('./utils/constant'); // Import roles from constants.js

    if (!id || !role || !Object.values(roles).includes(role)) {
      req.flash('error', 'Invalid request or role does not exist');
      return res.redirect('back');
    }

    if (req.user.id === id && role !== 'admin') {
      req.flash('error', 'Admins cannot demote themselves. Ask another admin.');
      return res.redirect('back');
    }

    const updatedUser = await User.findByIdAndUpdate(id, { role }, { new: true });
    if (!updatedUser) {
      req.flash('error', 'User not found');
      return res.redirect('users');
    }

    req.flash('success', 'Role updated successfully');
    res.redirect('/users');
  } catch (error) {
    next(error);
  }
});


app.get('/semi_admin', isAuthenticated, authRole("semi_admin"), async (req, res) => {
  res.send('Semi_admin Dashboard');
});

app.get('/Calender', isAuthenticated, authRole('admin'), async (req, res) => {
  try {
    const bookings = await Booking.aggregate([
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$tourDate" } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } } // Sort by date
    ]);

    res.render('calender', { bookings });
  } catch (error) {
    console.error('Error fetching bookings:', error.message);
    res.render('calender', { bookings: [] });
  }
});

app.get('/Calenders', isAuthenticated, authRole('semi_admin'), async (req, res) => {
  try {
    const bookings = await Booking.aggregate([
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$tourDate" } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } } // Sort by date
    ]);

    res.render('calender', { bookings });
  } catch (error) {
    console.error('Error fetching bookings:', error.message);
    res.render('calender', { bookings: [] });
  }
});





app.get('/TTour', isAuthenticated,authRole('admin'), async (req, res) => {
  try {
    const bookings = await Booking.find(); // Assuming Booking is your Mongoose model
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set time to the start of today for accurate comparison

    // Filter bookings for today and future dates
    const futureBookings = bookings.filter(booking => {
      const bookingDate = new Date(booking.tourDate); // Replace 'tourDate' with your date field name
      return bookingDate >= today; // Include bookings for today and future
    });

    // Calculate total bookings and Hiace bookings
    const totalBookings = futureBookings.length; // Total bookings for today and future
    const hiaceBookingsCount = futureBookings.filter(booking => booking.vehicleType === 'Hiace').length; // Hiace bookings count

    // Count bookings by vehicle type
    const vehicleCounts = {
      Minivan: futureBookings.filter(booking => booking.vehicleType === 'Minivan').length,
      Hiace: hiaceBookingsCount,
      Prius: futureBookings.filter(booking => booking.vehicleType === 'Prius').length,
      Prado: futureBookings.filter(booking => booking.vehicleType === 'Prado').length,
      'Luxury Car': futureBookings.filter(booking => booking.vehicleType === 'Luxury Car').length,
    };

    // Render the EJS file with the required data
    res.render('tours', {
      totalBookings,
      hiaceBookingsCount,
      vehicleCounts,
    });
  } catch (error) {
    console.error("Error fetching bookings:", error);
    res.status(500).send("Internal Server Error");
  }
});
app.get('/TTours', isAuthenticated,authRole('semi_admin'), async (req, res) => {
  try {
    const bookings = await Booking.find(); // Assuming Booking is your Mongoose model
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set time to the start of today for accurate comparison

    // Filter bookings for today and future dates
    const futureBookings = bookings.filter(booking => {
      const bookingDate = new Date(booking.tourDate); // Replace 'tourDate' with your date field name
      return bookingDate >= today; // Include bookings for today and future
    });

    // Calculate total bookings and Hiace bookings
    const totalBookings = futureBookings.length; // Total bookings for today and future
    const hiaceBookingsCount = futureBookings.filter(booking => booking.vehicleType === 'Hiace').length; // Hiace bookings count

    // Count bookings by vehicle type
    const vehicleCounts = {
      Minivan: futureBookings.filter(booking => booking.vehicleType === 'Minivan').length,
      Hiace: hiaceBookingsCount,
      Prius: futureBookings.filter(booking => booking.vehicleType === 'Prius').length,
      Prado: futureBookings.filter(booking => booking.vehicleType === 'Prado').length,
      'Luxury Car': futureBookings.filter(booking => booking.vehicleType === 'Luxury Car').length,
    };

    // Render the EJS file with the required data
    res.render('tours', {
      totalBookings,
      hiaceBookingsCount,
      vehicleCounts,
    });
  } catch (error) {
    console.error("Error fetching bookings:", error);
    res.status(500).send("Internal Server Error");
  }
});


app.get('/addBookings', isAuthenticated, authRole("admin"), async (req, res, next) => {
  res.render('addBooking');
});

app.post('/addBookings', isAuthenticated, authRole('admin'), async (req, res, next) => {
try {
  const { name, vehicleType, address, phoneNumber, tourDate, tourTime,tour, specialRequirements, totalPassengers } = req.body;


  const newBooking = new Booking({
    name,
    vehicleType,
    address,
    phoneNumber,
    tourDate,
    tourTime,
    tour,
    specialRequirements,
    totalPassengers
  });

  await newBooking.save();
  console.log('Booking added successfully:', newBooking); // Log the added booking
  req.flash('success', 'Booking added successfully!');
  res.redirect('/bookingsList'); // Redirect to the list after booking
} catch (error) {
  console.error('Error saving booking:', error.message); // Log the error message for debugging
  console.error('Full error object:', error); // Log the full error object
  req.flash('error', error.message || 'An error occurred while saving the booking.');
  res.redirect('/addBookings'); // Show error page
}
});



app.get('/api/bookings/:year/:month', async (req, res) => {
  try {
      const { year, month } = req.params;
      
      // Query the database for bookings in the given year and month
      const bookings = await Booking.find({
          tourDate: {
              $gte: new Date(year, month, 1),
              $lt: new Date(year, Number(month) + 1, 1)
          }
      }, 'tourDate');

      // Extract day from tourDate
      const bookedDays = bookings.map(booking => new Date(booking.tourDate).getDate());

      res.json({ bookedDays });
  } catch (error) {
      console.error('Error fetching bookings:', error);
      res.status(500).json({ error: 'Internal server error' });
  }
});
app.get('/getBookingsByDate/:date', async (req, res) => {
  const { date } = req.params;

  try {
      // Parse the date from the URL parameter
      const targetDate = new Date(date);
      // Set the start and end of the day
      const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
      const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));

      // Find bookings within the date range
      const bookings = await Booking.find({
          tourDate: {
              $gte: startOfDay,
              $lte: endOfDay
          }
      });

      res.json(bookings);
  } catch (error) {
      console.error("Error fetching tomorrow's bookings:", error);
      res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Route to get bookings by date range
app.get('/getBookingsByDateRange', async (req, res) => {
  const { start, end } = req.query;
  try {
      // Parse the start and end dates from query parameters
      const startDate = new Date(start);
      const endDate = new Date(end);
      // Set the start and end of the range
      const startOfRange = new Date(startDate.setHours(0, 0, 0, 0));
      const endOfRange = new Date(endDate.setHours(23, 59, 59, 999));
      // Find bookings within the date range and sort them in ascending order by tourDate
      const bookings = await Booking.find({
          tourDate: {
              $gte: startOfRange,
              $lte: endOfRange
          }
      }).sort({ tourDate: 1 }); // 1 for ascending order
      res.json(bookings);
  } catch (error) {
      console.error("Error fetching bookings by date range:", error);
      res.status(500).json({ message: 'Internal Server Error' });
  }
});



app.get('/bookingsList', isAuthenticated, authRole('admin'), async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set to start of today

    // Fetch all bookings for today and any day after today, sorted by tourDate in ascending order
    const bookings = await Booking.find({ tourDate: { $gte: today } }).sort({ tourDate: 1 });

    // Render the view with the filtered bookings
    res.render('bookingList', { 
      bookings: bookings, 
      totalBookings: bookings.length,
    });
  } catch (error) {
    console.error(error);
    // Handle error by rendering an empty booking list
    res.render('bookingList', { 
      bookings: [], 
      totalBookings: 0 // Return empty arrays on error
    });
  }
});


app.get('/bookingList', isAuthenticated, authRole('semi_admin'), async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set to start of today

    // Fetch all bookings for today and any day after today, sorted by tourDate in ascending order
    const bookings = await Booking.find({ tourDate: { $gte: today } }).sort({ tourDate: 1 });

    // Render the view with the filtered bookings
    res.render('bookingsList', { 
      bookings: bookings, // Pass all relevant bookings
      totalBookings: bookings.length, // Total bookings count
    });
  } catch (error) {
    console.error(error);
    // Handle error by rendering an empty booking list
    res.render('bookingsList', { 
      bookings: [], 
      totalBookings: 0 // Return empty arrays on error
    });
  }
});
app.get('/Driver_BookingList', isAuthenticated, authRole('driver'), async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set to start of today

    // Fetch all bookings for today and any day after today, sorted by tourDate in ascending order
    const bookings = await Booking.find({ tourDate: { $gte: today } }).sort({ tourDate: 1 });

    // Render the view with the filtered bookings
    res.render('Driver_BookingList', { 
      bookings: bookings, // Pass all relevant bookings
      totalBookings: bookings.length, // Total bookings count
    });
  } catch (error) {
    console.error(error);
    // Handle error by rendering an empty booking list
    res.render('Driver_BookingList', { 
      bookings: [], 
      totalBookings: 0 // Return empty arrays on error
    });
  }
});





app.delete('/deleteBooking/:id',isAuthenticated, authRole('admin'), async (req, res) => {
  try {
    const bookingId = req.params.id;
    await Booking.findByIdAndDelete(bookingId);
    res.status(200).send();
  } catch (error) {
    console.error(error);
    res.status(500).send('Error deleting booking');
  }
});


app.get('/editBooking/:id',isAuthenticated, authRole('admin'), async (req, res) => {
  try {
    const bookingId = req.params.id;
    const booking = await Booking.findById(bookingId);
    console.log(`Fetching booking with ID: ${req.params.id}`);
    if (!booking) {
      return res.status(404).send('Booking not found');
    }
    res.render('editBooking', { booking });
  } catch (error) {
    console.error(error);
    res.status(500).send('Error fetching booking for edit');
  }
});



app.post('/updateBooking/:id', async (req, res) => {
  try {
    const bookingId = req.params.id;
    const result = await Booking.findByIdAndUpdate(bookingId, req.body);
    if (!result) {
      return res.status(404).send('Booking not found');
    }
    res.redirect('/bookingsList');
  } catch (error) {
    console.error('Error updating booking:', error);
    res.status(500).send('Error updating booking');
  }
});


app.get('/report', (req, res) => {
  res.render('generateReport');
});


app.get('/generateReport', async (req, res) => {
  try {
    const { conversionRate, startDate, endDate } = req.query;

    // Validate inputs
    if (!conversionRate || !startDate || !endDate) {
      return res.status(400).send('Invalid inputs.');
    }

    const rate = parseFloat(conversionRate); // Conversion rate (e.g., 0.0064)
    const start = new Date(startDate);
    const end = new Date(endDate);

    // Fetch bookings within the date range
    const bookings = await Booking.find({
      tourDate: { $gte: start, $lte: end },
    });

    if (!bookings || bookings.length === 0) {
      return res.status(404).send('No bookings found.');
    }

    // Sort bookings by travel date (tourDate)
    bookings.sort((a, b) => new Date(a.tourDate) - new Date(b.tourDate));

    // Initialize ExcelJS workbook and worksheet
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Bookings Report');

    // Add headers
    worksheet.columns = [
      { header: 'Travel Date', key: 'travelDate', width: 15 },
      { header: 'Driver Name', key: 'driverName', width: 20 },
      { header: 'Traveler Name', key: 'travelerName', width: 20 },
      { header: 'Vehicle', key: 'vehicle', width: 15 },
      { header: 'Earning Price (USD)', key: 'earningPrice', width: 20 },
      { header: "Driver's Payment (JPY)", key: 'driverPayment', width: 20 },
    ];

    // Wrap text in headers
    worksheet.getRow(1).eachCell((cell) => {
      cell.alignment = { wrapText: true, horizontal: 'center', vertical: 'center' };
    });

    // Add data rows
    let totalEarnings = 0;
    let totalDriverPayments = 0;

    bookings.forEach((booking) => {
      const earningPrice = booking.earned ? parseFloat(booking.earned) : 0;
      const driverPaymentJPY = booking.driverPrice ? parseFloat(booking.driverPrice) : 0;

      totalEarnings += earningPrice;
      totalDriverPayments += driverPaymentJPY;

      worksheet.addRow({
        travelDate: new Date(booking.tourDate).toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: '2-digit',
        }),
        driverName: booking.driverName || 'N/A',
        travelerName: booking.name,
        vehicle: booking.vehicleType,
        earningPrice: `$${earningPrice.toFixed(2)}`,
        driverPayment: `¥${driverPaymentJPY.toFixed(2)}`,
      });
    });

    // Add total row
    const totalRow = worksheet.addRow({
      travelDate: 'TOTAL',
      earningPrice: `$${totalEarnings.toFixed(2)}`,
      driverPayment: `¥${totalDriverPayments.toFixed(2)}`,
    });

    totalRow.eachCell((cell) => {
      cell.font = { bold: true };
    });

    // Add USD conversion and profit calculation
    const totalDriverPaymentInUSD = (totalDriverPayments * rate).toFixed(2);
    const profit = (totalEarnings - totalDriverPaymentInUSD).toFixed(2);

    worksheet.addRow({}); // Empty row
    const conversionRow = worksheet.addRow({
      travelDate: 'Total Driver Payment (USD)',
      earningPrice: '',
      driverPayment: `$${totalDriverPaymentInUSD}`,
    });

    const profitRow = worksheet.addRow({
      travelDate: 'Profit (USD)',
      earningPrice: '',
      driverPayment: `$${profit}`,
    });

    conversionRow.eachCell((cell) => {
      cell.font = { bold: true };
    });

    profitRow.eachCell((cell) => {
      cell.font = { bold: true };
    });

    // Apply borders
    worksheet.eachRow((row) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
      });
    });

    // Set response headers for download
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=BookingsReport.xlsx'
    );

    // Write Excel file to response
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error generating report:', error);
    res.status(500).send('Internal Server Error');
  }
});






// Routes
app.use("/", require("./routes/indexRoute"));
app.use("/", require("./routes/authRoute"));
app.use("/", isAuthenticated, require("./routes/userRoute"));

// Error handling middleware
app.use((req, res, next) => {
  next(createHttpError.NotFound());
});

app.use((error, req, res, next) => {
  if (!res.headersSent) {
    error.status = error.status || 500;
    res.status(error.status);
    res.render("error", { error });
  } else {
    next(error);
  }
});

// MongoDB Connection
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("MongoDB connected successfully");
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
      console.log(`http://localhost:${PORT}`);
      
    });
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err);
  });
