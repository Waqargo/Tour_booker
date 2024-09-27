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
    // Assuming you have a Booking model to fetch bookings
    const bookings = await Booking.find({}).select('tourDate'); // Adjust fields as needed
    res.render('calender', { bookings });
  } catch (error) {
    console.error(error);
    res.render('calender', { bookings: [] });
  }
});
app.get('/Calenders', isAuthenticated, authRole('semi_admin'), async (req, res) => {
  try {
    // Assuming you have a Booking model to fetch bookings
    const bookings = await Booking.find({}).select('tourDate'); // Adjust fields as needed
    res.render('calender', { bookings });
  } catch (error) {
    console.error(error);
    res.render('calender', { bookings: [] });
  }
});

app.get('/driver', isAuthenticated, authRole("driver"), async (req, res) => {
  res.send('Driver Dashboard');
});

app.get('/addBookings', isAuthenticated, authRole("admin"), async (req, res, next) => {
  res.render('addBooking');
});

app.post('/addBookings', isAuthenticated, authRole('admin'), async (req, res, next) => {
try {
  const { name, vehicleType, address, phoneNumber, amount, tourDate, driverPayment, tourTime } = req.body;

  // Remove phone number validation and date validation
  // The new booking will be created regardless of the input validity.

  const newBooking = new Booking({
    name,
    vehicleType,
    address,
    phoneNumber,
    amount,
    tourDate,
    tourTime,
    driverPayment,
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

      // Find bookings within the date range
      const bookings = await Booking.find({
          tourDate: {
              $gte: startOfRange,
              $lte: endOfRange
          }
      });

      res.json(bookings);
  } catch (error) {
      console.error("Error fetching bookings by date range:", error);
      res.status(500).json({ message: 'Internal Server Error' });
  }
});



app.get('/bookingsList', isAuthenticated, authRole('admin', 'semi_admin', 'driver'), async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set to start of today
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1); // Set to yesterday

    // Fetch all bookings sorted by tourDate in ascending order
    const bookings = await Booking.find({}).sort({ tourDate: 1 });

    // Filter bookings into categories
    const yesterdayBookings = bookings.filter(booking => new Date(booking.tourDate).toDateString() === yesterday.toDateString());
    const todayBookings = bookings.filter(booking => new Date(booking.tourDate).toDateString() === today.toDateString());
    const futureBookings = bookings.filter(booking => new Date(booking.tourDate) > today);

    // Combine all relevant bookings for easier handling in the template
    const relevantBookings = [...yesterdayBookings, ...todayBookings, ...futureBookings];

    // Render the view with the required data
    res.render('bookingList', { 
      bookings: relevantBookings, // Pass only relevant bookings
      totalBookings: bookings.length, // Total bookings count
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
app.get('/bookingList', isAuthenticated, authRole('semi_admin', 'driver'), async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set to start of today
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1); // Set to yesterday

    // Fetch all bookings sorted by tourDate in ascending order
    const bookings = await Booking.find({}).sort({ tourDate: 1 });

    // Filter bookings into categories
    const yesterdayBookings = bookings.filter(booking => new Date(booking.tourDate).toDateString() === yesterday.toDateString());
    const todayBookings = bookings.filter(booking => new Date(booking.tourDate).toDateString() === today.toDateString());
    const futureBookings = bookings.filter(booking => new Date(booking.tourDate) > today);

    // Combine all relevant bookings for easier handling in the template
    const relevantBookings = [...yesterdayBookings, ...todayBookings, ...futureBookings];

    // Render the view with the required data
    res.render('bookingList', { 
      bookings: relevantBookings, // Pass only relevant bookings
      totalBookings: bookings.length, // Total bookings count
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





app.delete('/deleteBooking/:id', async (req, res) => {
  try {
    const bookingId = req.params.id;
    await Booking.findByIdAndDelete(bookingId);
    res.status(200).send();
  } catch (error) {
    console.error(error);
    res.status(500).send('Error deleting booking');
  }
});


app.get('/editBooking/:id', async (req, res) => {
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
      console.log(`https://localhost:${PORT}`);
      
    });
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err);
  });
