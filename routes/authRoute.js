const router = require("express").Router();
const User = require("../models/userModel");
const { body, validationResult } = require("express-validator");
const passport = require("passport");

router.get("/register", async (req, res, next) => {
  const messages = req.flash();
  res.render("register", { messages });
});

router.post(
  "/register",
  [
    body("email")
      .trim()
      .isEmail()
      .withMessage("Please provide a valid email address")
      .normalizeEmail()
      .toLowerCase(),
    body("password")
      .trim()
      .isLength({ min: 2 })
      .withMessage("Password length is short, minimum 2 characters required"),
    body("password2").custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error("Passwords don't match");
      }
      return true;
    }),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        errors.array().forEach((error) => {
          req.flash("error", error.msg);
        });
        res.render("register", {
          email: req.body.email,
          messages: req.flash(),
        });
        return;
      }

      const { email } = req.body;

      const doesExist = await User.findOne({ email });

      if (doesExist) {
        req.flash("error", "Email already exists");
        res.redirect("/register");
        return;
      }

      // Create a new user with the determined role
      const newUser = new User({ email, password: req.body.password });
      await newUser.save();

      req.flash("success", `${newUser.email} registered successfully`);
      res.redirect("/login");
    } catch (error) {
      next(error);
    }
  }
);

router.get("/login", async (req, res, next) => {
  res.render("login");
});

router.post(
  "/login",
  passport.authenticate("local", {
    successReturnToOrRedirect: "/",
    failureRedirect: "/login",
    failureFlash: true,
  })
);

router.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Error destroying session:", err);
    } else {
      res.redirect("/");
    }
  });
});

module.exports = router;
