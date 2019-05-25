/**
 * Copyright 2015 IBM Corp. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

var express = require('express'); // app server
var bodyParser = require('body-parser'); // parser for post requests
var AssistantV2 = require('watson-developer-cloud/assistant/v2'); // watson sdk
var session = require('express-session');
const fs = require('fs');

var app = express();
app.use(bodyParser.urlencoded({ extended: true }));

// Bootstrap application settings
app.use(bodyParser.json());

app.set('views', __dirname + '/public/views');
app.use(express.static(__dirname + '/public'));
app.engine('html', require('ejs').renderFile);
app.set('view engine', 'html');

app.set('trust proxy', 1) // trust first proxy
app.use(session({
  secret: 'keyboard cat',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: true }
}))

// Create the service wrapper

var assistant = new AssistantV2({
  version: '2018-11-08'
});

var newContext = {
  global : {
    system : {
      turn_count : 1
    }
  }
};

// Endpoint to be call from the client side
app.post('/api/message', function (req, res) {
  var assistantId = process.env.ASSISTANT_ID || '<assistant-id>';
  if (!assistantId || assistantId === '<assistant-id>>') {
    return res.json({
      'output': {
        'text': 'The app has not been configured with a <b>ASSISTANT_ID</b> environment variable. Please refer to the ' + '<a href="https://github.com/watson-developer-cloud/assistant-simple">README</a> documentation on how to set this variable. <br>' + 'Once a workspace has been defined the intents may be imported from ' + '<a href="https://github.com/watson-developer-cloud/assistant-simple/blob/master/training/car_workspace.json">here</a> in order to get a working application.'
      }
    });
  }
  var contextWithAcc = (req.body.context) ? req.body.context : newContext;

  if (req.body.context) {
    contextWithAcc.global.system.turn_count += 1;
  }

  //console.log(JSON.stringify(contextWithAcc, null, 2));

  var textIn = '';

  if(req.body.input) {
    textIn = req.body.input.text;
  }

  var payload = {
    assistant_id: assistantId,
    session_id: req.body.session_id,
    context: contextWithAcc,
    input: {
      message_type : 'text',
      text : textIn,
      options : {
        return_context : true
      }
    }
  };

  // Send the input to the assistant service
  assistant.message(payload, function (err, data) {
    if (err) {
      const status = (err.code  !== undefined && err.code > 0)? err.code : 500;
      return res.status(status).json(err);
    }

    return res.json(data);
  });
});

app.get('/api/session', function (req, res) {
  assistant.createSession({
    assistant_id: process.env.ASSISTANT_ID || '{assistant_id}',
  }, function (error, response) {
    if (error) {
      return res.send(error);
    } else {
      return res.send(response);
    }
  });
});

app.get('/', function (req, res) {
  var txt_infos = "";
  if (!session.user)
    return res.render('login.html', {error: ""});
  fs.readFile(__dirname + '/data/informations.json', (err, data) => {  
    if (err) throw err;
    let infos = JSON.parse(data);
    infos.map(info => {
      txt_infos += "<div class=\"infos\">\
      <div class=\"infos-title\">${info.title} <small>${info.date}</small></div>\
      <div class=\"infos-desc\">${info.description}</div>\
      <div class=\"infos-author\">${info.author}</div>\
      </div>";
    });
  });
  return res.render('home.html', {user: session.user, infos: txt_infos});
});

app.post('/', function (req, res) {
  if (!req.body.name || !req.body.password)
    return res.end("No enter !");
  fs.readFile(__dirname + '/data/users.json', (err, data) => {  
    if (err) throw err;
    let users = JSON.parse(data);
    users.map(user => {
      if (user.email == req.body.name && user.password == req.body.password) {
        session.user = user.last_name + ' ' + user.first_name.substr(0, 1) + '.';
        session.perm = user.all_perm;
        session.email = user.email;
      }
    });
  });
  if (session.user)
    return res.end("success");
  return res.end("No match !");
});

app.get('/home', function (req, res) {
  if (!session.user)
    return res.redirect('/');
  if (!session.perm)
    return res.render('l-home.html', {user: session.user});
  return res.render('home.html', {user: session.user});
});

app.get('/chat-bot', function (req, res) {
  if (!session.user)
    return res.redirect('/');
  if (!session.perm)
    return res.render('l-chat-bot.html', {user: session.user});
  return res.render('chat-bot.html', {user: session.user});
});

app.get('/e-learning', function (req, res) {
  if (!session.user)
    return res.redirect('/');
  return res.render('e-learning.html', {user: session.user});
});

app.get('/others', function (req, res) {
  if (!session.user)
    return res.redirect('/');
  if (!session.perm)
    return res.render('l-others.html', {user: session.user});
  return res.render('others.html', {user: session.user});
});

app.get('/others/profile', function (req, res) {
  if (!session.user)
    return res.redirect('/');
  fs.readFile(__dirname + '/data/users.json', (err, data) => {  
    if (err) throw err;
      let users = JSON.parse(data);
      users.map(user => {
      if (user.email == session.email) {
        if (!session.perm)
          return res.render('l-profile.html', {user: session.user, first_name: user.first_name, last_name: user.last_name, email: session.email, phone: user.phone, rank: user.rank, perm: session.perm ? "Oui" : "Non", photo: user.photo ? user.photo : "https://png.pngtree.com/svg/20170527/e4e70ac79e.svg"});
        return res.render('profile.html', {user: session.user, first_name: user.first_name, last_name: user.last_name, email: session.email, phone: user.phone, rank: user.rank, perm: session.perm ? "Oui" : "Non", photo: user.photo ? user.photo : "https://png.pngtree.com/svg/20170527/e4e70ac79e.svg"});
      }
    });
  });
});

app.get('/others/parameters', function (req, res) {
  if (!session.user)
    return res.redirect('/');
  if (!session.perm)
    return res.render('l-params.html', {user: session.user});
  return res.render('params.html', {user: session.user});
});

app.get('/others/assist', function (req, res) {
  if (!session.user)
    return res.redirect('/');
  if (!session.perm)
    return res.render('l-assist.html', {user: session.user});
  return res.render('assist.html', {user: session.user});
});

app.get('/others/logout', function (req, res) {
  session.user = null;
  return res.redirect('/');
});

module.exports = app;