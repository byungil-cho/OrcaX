const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

app.get('/api/ping', (req, res) => res.send("pong"));

// API 연동
app.use('/api/farm', require('./routes/farm'));
app.use('/api/harvest', require('./routes/harvest'));
app.use('/api/product', require('./routes/product'));

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB connected!");
    app.listen(process.env.PORT || 6000, () => {
      console.log("Server running on port", process.env.PORT || 6000);
    });
  })
  .catch(err => console.error(err));
