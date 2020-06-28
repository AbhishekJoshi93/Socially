//jshint esversion:8

require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const passport = require('passport');
const session = require("express-session");
const passportLocalMongoose = require("passport-local-mongoose");
const googlestrategy = require('passport-google-oauth20').Strategy;
const findOrCreate = require('mongoose-findorcreate');
const fileupload = require('express-fileupload');
const path = require('path');

const app = express();

app.use(express.static(__dirname + "/public"));
app.set("view engine","ejs");
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended:true}));

app.use(fileupload());

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

mongoose.connect("mongodb+srv://abhishekjoshi:abhishekjoshi@cluster0-jegoe.mongodb.net/sociallyDB", {useNewUrlParser: true, useCreateIndex: true, useUnifiedTopology: true});
mongoose.set("useCreateIndex", true);

const userSchema = new mongoose.Schema({
    googleId: String,
    username: String,
    profiletype: {type: Boolean,default: true},
    profiledate: {type: Date,default: Date.now},
    profilename: String,
    profilebio: String,
    profileage: Number,
    profilenumber: Number,
    profileimage: String,
    profilefriends: Array,
    profilependingfriends: Array,
    profilecomplete: {type: Boolean,default: false},
    profilepost: [{
        postuserid: String,
        postimage: String,
        postcomment: String,
        postdate: {type: Date,default: Date.now},
        postlike: [Array],
        postcomments: [{
            postcommentid: String,
            postcommentname: String,
        }],
    }],
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User = new mongoose.model("User", userSchema);

passport.use(User.createStrategy());

passport.serializeUser(function(user, done) {
    done(null, user.id);
});
  
passport.deserializeUser(function(id, done) {
    User.findById(id, function(err, user) {
      done(err, user);
    });
});

app.get("/",(req,res)=>{
    res.render(__dirname + "/views/index.ejs");
});

passport.use(new googlestrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/socially"
  },
  function(accessToken, refreshToken, profile, cb) {
    User.findOrCreate({ googleId: profile.id,username: profile.displayName }, function (err, user) {
      return cb(err, user);
    });
  }
));

app.get("/auth/google",passport.authenticate('google', { scope: ['profile'] }));

app.get("/auth/google/socially",passport.authenticate('google', { failureRedirect: "/" }),
    function(req, res) {
        res.redirect("/home");
});

app.get("/home",(req,res)=>{
    if(req.isAuthenticated()){
        User.findById(req.user.id, function(err,foundUser){
            if(foundUser.profilecomplete == true){
                res.redirect("/main");
            }else{
                res.render(__dirname + "/views/home.ejs");
            }
        });
    }else{
        res.redirect("/");
    }
});

app.post("/profilesubmit",(req,res)=>{
    if(req.isAuthenticated()){
        var file = req.files.profileimage;
        var filename = file.name;
        User.findById(req.user.id, function(err,foundUser){
            if(err){
                console.log(err);
            }else{
                if(foundUser){
                    file.mv('./public/uploads/'+filename,function(err){
                        if(err){
                            console.log(err);
                        }
                    });
                    foundUser.profileimage = filename;
                    foundUser.profilename = req.body.profilename;
                    foundUser.profilebio = req.body.profilebio;
                    foundUser.profilegender = req.body.profilegender;
                    foundUser.profileage = req.body.profileage;
                    foundUser.profilenumber = req.body.profilenumber;
                    foundUser.profilecomplete = true;
                    foundUser.profiletype = true;
                    foundUser.save(function(err){
                        if(err){
                            res.redirect("/home");
                        }else{
                            res.redirect("/main");
                        }
                    });
                }
            }
        });
    }else{
        res.redirect("/");
    }
});

app.get("/main",(req,res)=>{
    if(req.isAuthenticated()){

        User.findById(req.user._id,(err,result) => {

            User.find({},(err,db) => {
                res.render(__dirname + "/views/main.ejs",{current: result,all: db});
            });

        });

    }else{
        res.redirect("/");
    }
});

app.get("/feed",(req,res)=>{
    if(req.isAuthenticated()){

        User.find({},(err,db) => {
            res.render(__dirname + "/views/feed.ejs",{user: req.user,all: db});
        });

    }else{
        res.redirect("/");
    }
});

app.get("/chat",(req,res)=>{
    if(req.isAuthenticated()){

        User.findById(req.user._id,(err,result) => {

            User.find({},(err,db) => {
                res.render(__dirname + "/views/chat.ejs",{users: result,all: db});
            });

        });

    }else{
        res.redirect("/");
    }
});

app.get("/user",(req,res)=>{
    if(req.isAuthenticated()){
        User.find({},(err,db) => {
            res.render(__dirname + "/views/user.ejs",{user: req.user,all: db});
        });
    }else{
        res.redirect("/");
    }
});

app.get("/upload",(req,res)=>{
    if(req.isAuthenticated()){
        res.render(__dirname + "/views/upload.ejs");
    }else{
        res.redirect("/");
    }
});

app.post("/searchuser",(req,res)=>{
    if(req.isAuthenticated()){
        
        User.find({profilename: req.body.searchname},(err,result) => {
            res.render(__dirname + "/views/find.ejs",{users: result});
        });

    }else{
        res.redirect("/");
    }
});

app.post("/finduser",(req,res)=>{
    if(req.isAuthenticated()){
        
        User.findById(req.body.finduser,(err,result) => {
            if(req.user.id == req.body.finduser){
                res.redirect("/profile");
            }else{
                res.render(__dirname + "/views/finduser.ejs",{user: result,current: req.user});
            }
        });
        
    }else{
        res.redirect("/");
    }
});

app.post("/friendrequest",(req,res)=>{
    if(req.isAuthenticated()){
        
        User.find({_id: req.body.friendrequest},(err,result) => {
            result[0].profilependingfriends.push(req.user._id.toString());
            result[0].save();
            res.redirect("/main");
        });

    }else{
        res.redirect("/");
    }
});

app.post("/friendaccept",(req,res)=>{
    if(req.isAuthenticated()){
        
        User.findById(req.user,(err,result) => {
            result.profilefriends.push(req.body.friendaccept);
            var i =result.profilependingfriends.indexOf(req.body.friendaccept);
            result.profilependingfriends.splice(i, 1);
            User.find({_id: req.body.friendaccept},(err,result2) => {
                result2[0].profilefriends.push(req.user._id.toString());
                result2[0].save();
                result.save();
                res.redirect("/user");
            });
        });

    }else{
        res.redirect("/");
    }
});

app.post("/friendreject",(req,res)=>{
    if(req.isAuthenticated()){
        
        User.findById(req.user,(err,result) => {
            var i = result.profilependingfriends.indexOf(req.body.friendaccept);
            result.profilependingfriends.splice(i, 1);
            result.save();
            res.redirect("/user");
        });

    }else{
        res.redirect("/");
    }
});

app.get("/profile",(req,res)=>{
    if(req.isAuthenticated()){
        res.render(__dirname + "/views/profile.ejs",{user: req.user});
    }else{
        res.redirect("/");
    }
});

app.post("/unfriend",(req,res)=>{
    if(req.isAuthenticated()){
        
        User.findById(req.user,(err,result) => {
            var i =result.profilefriends.indexOf(req.body.unfriend);
            result.profilefriends.splice(i, 1);
            User.find({_id: req.body.unfriend},(err,result2) => {
                var j =result2[0].profilefriends.indexOf(req.user._id.toString());
                result2[0].profilefriends.splice(j, 1);
                result2[0].save();
                result.save();
                res.redirect("/main");
            });
        });

    }else{
        res.redirect("/");
    }
});

app.post("/profileedit",(req,res)=>{
    if(req.isAuthenticated()){
        res.render(__dirname + "/views/edit.ejs",{user: req.user});
    }else{
        res.redirect("/");
    }
});

app.post("/profileeditimage",(req,res)=>{
    if(req.isAuthenticated()){
        res.render(__dirname + "/views/editphoto.ejs",{user: req.user});
    }else{
        res.redirect("/");
    }
});

app.post("/profileimageupdated",(req,res)=>{
    if(req.isAuthenticated()){
        var file = req.files.profileimage;
        var filename = file.name;
        User.findById(req.user.id, function(err,foundUser){
            if(err){
                console.log(err);
            }else{
                if(foundUser){
                    file.mv('./public/uploads/'+filename,function(err){
                        if(err){
                            console.log(err);
                        }
                    });
                    foundUser.profileimage = filename;
                    foundUser.save(function(err){
                        if(err){
                            res.redirect("/profile");
                        }else{
                            res.redirect("/profile");
                        }
                    });
                }
            }
        });
    }else{
        res.redirect("/");
    }
});

app.post("/profileupdated",(req,res)=>{
    if(req.isAuthenticated()){
        User.findById(req.user.id, function(err,foundUser){
            if(err){
                console.log(err);
            }else{
                if(foundUser){
                    foundUser.profilename = req.body.profilename;
                    foundUser.profilebio = req.body.profilebio;
                    foundUser.profilegender = req.body.profilegender;
                    foundUser.profileage = req.body.profileage;
                    foundUser.profilenumber = req.body.profilenumber;
                    foundUser.save(function(err){
                        if(err){
                            res.redirect("/profile");
                        }else{
                            res.redirect("/profile");
                        }
                    });
                }
            }
        });
    }else{
        res.redirect("/");
    }
});

app.post("/canceledit",(req,res)=>{
    if(req.isAuthenticated()){
        res.redirect("/profile");
    }else{
        res.redirect("/");
    }
});

app.post("/viewfriends",(req,res)=>{
    if(req.isAuthenticated()){

        User.findById(req.body.unfriend,(err,result) => {

            User.find({},(err,db) => {
                res.render(__dirname + "/views/viewfriends.ejs",{users: result,all: db});
            });

        });

    }else{
        res.redirect("/");
    }
});

app.post("/viewfriendsprofile",(req,res)=>{
    if(req.isAuthenticated()){

        User.findById(req.user._id,(err,result) => {

            User.find({},(err,db) => {
                res.render(__dirname + "/views/viewfriends.ejs",{users: result,all: db});
            });

        });

    }else{
        res.redirect("/");
    }
});

app.post("/postimage",(req,res)=>{
    if(req.isAuthenticated()){

        var file = req.files.postimage;
        var filename = file.name;

        User.findById(req.user.id, function(err,foundUser){
            if(err){
                console.log(err);
            }else{
                if(foundUser){
                    file.mv('./public/uploads/'+filename,function(err){
                        if(err){
                            console.log(err);
                        }
                    });

                    if(foundUser.profilepost.length > 0){
                        res.redirect("/main");
                    }else{
                        const body = {
                            postimage: filename,
                            postcomment: req.body.postcomment,
                            postuserid: req.user._id.toString(),
                        };
    
                        foundUser.profilepost.push(body);
                        foundUser.save(function(err){
                            if(err){
                                res.redirect("/profile");
                            }else{
                                res.redirect("/profile");
                            }
                        });
                    }

                }
            }
        });

    }else{
        res.redirect("/");
    }
});

app.post("/publicacc",(req,res)=>{
    if(req.isAuthenticated()){
        User.findById(req.user._id,(err,result) => {

            if(result.profiletype == true){
                result.profiletype = false;
            }else{
                result.profiletype = true;
            }
            result.save();
            res.render(__dirname + "/views/edit.ejs",{user: req.user});

        });
    }else{
        res.redirect("/");
    }
});

app.post("/postimagedeep",(req,res)=>{
    if(req.isAuthenticated()){
        User.find({_id: req.body.postimagedeepuser},(err,result) => {
            res.render(__dirname + "/views/detailpost.ejs",{user: result[0],postid: req.body.postimagedeep,currentid: req.user._id.toString()});
        });
    }else{
        res.redirect("/");
    }
});

app.post("/postlike",(req,res)=>{
    if(req.isAuthenticated()){
        User.find({_id: req.body.postimagedeepuser},(err,result) => {
            result[0].profilepost.forEach(function(post){
                if(post._id == req.body.postimagedeep){
                    var x=-1;
                    x = post.postlike.indexOf(req.user._id.toString());

                    if(x == -1){
                        post.postlike.push(req.user._id.toString());
                    }else{
                        post.postlike.splice(x,1);
                    }

                }
            });
            result[0].save();
            res.render(__dirname + "/views/detailpost.ejs",{user: result[0],postid: req.body.postimagedeep,currentid: req.user._id.toString()});
        });
    }else{
        res.redirect("/");
    }
});

app.post("/commentinput",(req,res)=>{
    if(req.isAuthenticated()){
        
        const body = {
            postcommentid: req.user.profilename,
            postcommentname: req.body.commentinput,
        };

        User.find({_id: req.body.postimagedeepuser},(err,result) => {
            result[0].profilepost.forEach(function(post){
                if(post._id == req.body.postimagedeep){
                    post.postcomments.push(body);
                }
            });
            result[0].save();
            res.render(__dirname + "/views/detailpost.ejs",{user: result[0],postid: req.body.postimagedeep,currentid: req.user._id.toString()});
        });

    }else{
        res.redirect("/");
    }
});

let port = process.env.PORT; 

if(port == null || port == ""){
    port = 3000;
}

app.listen(port, () => {
    console.log("Website is running");
});
