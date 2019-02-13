const express = require('express');
const bcrypt = require('bcrypt');
const axios = require('axios');
const qs = require('query-string');
const User = require('../models/user');
const Country = require('../models/country');
const loggedInRoute = require('../middlewares/loggedIn');
require('dotenv').config();

const router = express.Router();
const bcryptSalt = 10;

router.get('/login', loggedInRoute, (req, res, next) => {
  const clientId = process.env.CLIENT_ID;
  const redirectUri = process.env.REDIRECT_URI;
  res.render('auth/login', { clientId, redirectUri });
});

router.get('/login/instagram', async (req, res, next) => {
  const { code } = req.query;

  try {
    const result = await axios.post(
      'https://api.instagram.com/oauth/access_token',
      qs.stringify({
        client_id: process.env.CLIENT_ID,
        client_secret: process.env.CLIENT_SECRET,
        grant_type: 'authorization_code',
        redirect_uri: process.env.REDIRECT_URI,
        code,
      }),
    );
    const { username, profile_picture } = result.data.user;
    const token = result.data.access_token;
    const salt = bcrypt.genSaltSync(bcryptSalt);
    const hashPass = bcrypt.hashSync(username, salt);
    const user = await User.findOne({ username });
    if (!user) {
      const userCreated = await User.create({
        username,
        password: hashPass,
        profilePicture: profile_picture,
        isCreatedFromInstagram: true,
      });
      req.session.currentUser = userCreated;
    } else {
      req.session.currentUser = user;
    }

    // HOW TO PROTECT THE TOKEN????
    const media = await axios.get(`https://api.instagram.com/v1/users/self/media/recent/?access_token=${token}`);  
    //console.log(media.data.data);


    media.data.data.forEach((photo) => {
      console.log('location object', photo.location);
    });


    res.redirect('/travellog');

  } catch (error) {
    next(error);
  }
});

router.post('/login', (req, res, next) => {
  const { username, password } = req.body;

  if (username === '' || password === '') {
    req.flash('info', 'Please fill all fields');
    res.redirect('/auth/login');
  }
  User.findOne({ username })
    .then((user) => {
      console.log('USER LOGIN: ', user);
      console.log('USER type: ', typeof user);

      if (!user || user === null) {
        req.flash('error', 'Incorrect user or password');
        res.redirect('/auth/login');
      }
      if (bcrypt.compareSync(password, user.password)) {
        // Save the login in the session!
        req.session.currentUser = user;
        res.redirect('/travellog');
      } else {
        req.flash('error', 'Incorrect user or password');
        res.redirect('/auth/login');
      }
    })
    .catch((error) => {
      next(error);
    });
});

router.get('/signup', loggedInRoute, (req, res, next) => {
  const clientId = process.env.CLIENT_ID;
  const redirectUri = process.env.REDIRECT_URI;
  Country.find({})
    .then((countries) => {
      res.render('auth/signup', { countries, clientId, redirectUri });
    })
    .catch((error) => {
      next(error);
    });
});

router.post('/signup', (req, res, next) => {
  const { username, password, homeCountry } = req.body;
  const salt = bcrypt.genSaltSync(bcryptSalt);
  const hashPass = bcrypt.hashSync(password, salt);

  if (username === '' || password === '' || homeCountry === '') {
    req.flash('info', 'Please fill all fields');
    res.redirect('/auth/signup');
  }
  User.findOne({ username })
    .then((user) => {
      if (!user) {
        User.create({
          username,
          password: hashPass,
          homeCountry,
        })
          .then((userCreated) => {
            req.session.currentUser = userCreated;
            res.redirect('/travellog');
          })
          .catch((error) => {
            next(error);
          });
      } else {
        req.flash('error', 'Incorrect values');
        res.redirect('/auth/signup');
      }
    })
    .catch((error) => {
      next(error);
    });
});

router.get('/logout', (req, res, next) => {
  req.session.destroy(() => {
    // cannot access session here
    res.redirect('/');
  });
});

module.exports = router;
