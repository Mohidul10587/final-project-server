const express = require('express')
const http = require('http');
const { MongoClient, ServerApiVersion } = require('mongodb');
const jwt = require('jsonwebtoken')
const cors = require('cors');
const { response } = require('express');
require('dotenv').config()

const app = express()
const port = process.env.PORT || 5000

app.use(cors())
app.use(express.json())

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ysiejik.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send({ message: "UnAuthorized access" })
  }
  const token = authHeader.split(' ')[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_VAR, function (err, decoded) {
    if (err) {
      return res.status(403).send({ massage: 'forbidden' })
    }

    req.decoded = decoded;
    next();
  });
}
async function run() {
  try {
    await client.connect()
    console.log('connected')
    const serviceCollection = client.db('doctors_portal').collection('services')
    const bookingCollection = client.db('doctors_portal').collection('booking')
    const usersCollection = client.db('doctors_portal').collection('users')


    app.get('/service', async (req, res) => {
      const query = {};
      const cursor = serviceCollection.find(query);
      const service = await cursor.toArray();
      res.send(service)
    })
    app.put('/user/:email', async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const filter = { email: email };
      const options = { upsert: true };
      const updateDoc = {

        $set: user
      }
      const result = await usersCollection.updateOne(filter, updateDoc, options)
      const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_VAR, { expiresIn: '1h' })
      res.send({ result, token })
    })



    app.get('/available', async (req, res) => {
      const date = req.query.date
      const services = await serviceCollection.find().toArray()
      const query = { date: date }
      const bookings = await bookingCollection.find(query).toArray()
      services.forEach(service => {
        const serviceBookings = bookings.filter(book => book.treatment === service.name)
        const bookedSlots = serviceBookings.map(book => book.slot)
        const available = service.slots.filter(slot => !bookedSlots.includes(slot))
        service.slots = available

      })
      res.send(services)

    })

    app.get('/booking', verifyJWT, async (req, res) => {
      const patient = req.query.patient;
      const decodedEmail = req.decoded.email;
      if (decodedEmail === patient) {

        const query = { patient: patient };
        const bookings = await bookingCollection.find(query).toArray()
        res.send(bookings)
      }
      else{
        return res.status(403).send({massage:"forbidden access"})
      }

    })

    app.post('/booking', async (req, res) => {
      const booking = req.body;
      const query = { treatment: booking.treatment, date: booking.date, patient: booking.patient }
      const exists = await bookingCollection.findOne(query);
      if (exists) {
        return res.send({ success: false, booking: exists })
      }
      const result = await bookingCollection.insertOne(booking);
      return res.send({ success: true, result });
    })
  } finally {

  }
  // sudo /opt/lampp/./manager-linux-x64.run



}

run().catch(console.dir)


app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})
