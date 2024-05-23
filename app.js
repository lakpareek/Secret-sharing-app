//jshint esversion:6
require('dotenv').config();
const express = require("express");
const ejs = require("ejs");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const bcrypt = require('bcrypt');
var session = require('express-session');
var passport = require("passport");
var passportLocalMongose = require("passport-local-mongoose");
const GoogleStrategy = require('passport-google-oauth20').Strategy;
var findOrCreate = require('mongoose-findorcreate');

const app = express();
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static("public"));

app.use(session({
    secret: 'keyboard cat',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }
}));
app.use(passport.initialize());
app.use(passport.session());

mongoose.connect("mongodb://localhost:27017/UserDB", {useNewUrlParser: true});
const userSchema = new mongoose.Schema({
    email: String,
    password: String,
    googleId: String,
    secret: String
});
userSchema.plugin(passportLocalMongose);
userSchema.plugin(findOrCreate);
const User = new mongoose.model("User", userSchema);

passport.use(User.createStrategy());
passport.serializeUser(function(user, cb) {
    process.nextTick(function() {
      cb(null, { id: user.id, username: user.username });
    });
  });
  
  passport.deserializeUser(function(user, cb) {
    process.nextTick(function() {
      return cb(null, user);
    });
  });
passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/secrets",
    userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
  },
  function(accessToken, refreshToken, profile, cb) {
    console.log(profile);
    User.findOrCreate({ googleId: profile.id }, function (err, user) {
      return cb(err, user);
    });
  }
));

app.get('/auth/google/secrets', 
  passport.authenticate('google', { failureRedirect: '/login' }),
  function(req, res) {
    // Successful authentication, redirect home.
    res.redirect('/secrets');
  });

app.get("/", (req, res)=>{
    res.render("home");
});
app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile'] })
);
app.get("/login", (req, res)=>{
    res.render("login");
});
app.get("/register", (req, res)=>{
    res.render("register");
});
app.get("/logout", (req, res) =>{
    req.logout(function(err) {
        if (err) { return next(err); }
    });
    res.redirect("/");
})

app.get("/submit", (req, res) => {
    if(req.isAuthenticated){
        res.render("submit");
    }else{
        res.redirect("login");
    }
});

app.post("/submit", (req, res) => {
    const submitedSecret = req.body.secret;
    console.log(submitedSecret);
    console.log(req.user);
    console.log(req.user.id);
    User.findById(req.user.id)
        .then((foundItems)=>{
            foundItems.secret= submitedSecret;
            foundItems.save()
                .then(()=>{
                    res.redirect("/secrets");
                }).catch(err => {
                    console.log(err);
                })

        }).catch(err=>{
            console.log(err);
        })
});

app.post("/login", (req, res)=>{
    const user = new User({
        username:  req.body.username,
        password: req.body.password
    });
    req.login(user, (err) => {
        if(err){
            console.log(err);
        }else{
            passport.authenticate("local")(req, res, function(){
                res.redirect("/secrets");
            });
        }
    })
    
});

app.get("/secrets", async function(req, res){
    let findUsers;
    try{
        findUsers = await User.find({"secret": {$ne: null}});
    }catch{
        console.log(err);
    }
    if(findUsers){
        res.render("secrets", {userWithSecrets: findUsers});
    }
});

app.post("/register", (req, res) => {
    User.register({ username: req.body.username, active: false }, req.body.password, function (err, user) {
        if (err) {
            console.log(err);
            res.redirect("register");
        }else{
            passport.authenticate("local")(req, res, function(){
                res.redirect("/secrets");
            });
        }
    });
});

app.listen(3000, ()=>{
    console.log("Listening at port 3000");
});
