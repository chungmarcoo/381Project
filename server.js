var express = require('express')
var session = require('cookie-session')
var bodyParser = require('body-parser')
var app = express()
var http = require('http')
var url = require('url')
var MongoClient = require('mongodb').MongoClient
var assert = require('assert')
var ObjectId = require('mongodb').ObjectID
var mongourl = 'mongodb://project:project1234@ds245532.mlab.com:45532/chung_marco'
var crypto = require('crypto')
var mongoose = require('mongoose')
var Schema = mongoose.Schema
var mime = require('mime-types')
var fs = require('fs')
var formidable = require('formidable')
var util = require('util')

var restaurantSchema = new Schema({
	restaurant_id: Number,
	name: { type: String, required: true },
	borough: String,
	cuisine: String,
	photo: Buffer,
	photoMimetype: String,
	address: [{
		street: String,
		building: String,
		zipcode: String,
		coord: [{ lat: Number, lon: Number }]
	}],
	grades: [{
		user: String,
		score: Number
	}],
	owner: { type: String, required: true }
})

app = express()

app.set('view engine', 'ejs')

var SECRETKEY1 = crypto.randomBytes(64).toString('hex')
var SECRETKEY2 = crypto.randomBytes(64).toString('hex')

app.set('view engine', 'ejs')

app.use(session({
	name: 'session',
	keys: [SECRETKEY1, SECRETKEY2]
}))
app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())
app.use(express.static('public'))

app.get('/', function (req, res) {
	// console.log(req.session)
	if (!req.session.username && !req.session.authenticated) {
		res.redirect('/login')
	} else {
		res.status(200)
		res.render('secrets', { name: req.session.username })
	}
})

app.get('/read', function (req, res) {
	if (!req.session.username && !req.session.authenticated) {
		res.redirect('/login')
	} else {
		MongoClient.connect(mongourl, function (err, db) {
			assert.equal(err, null)
			console.log('Connected to MongoDB\n')
			findRestaurants(db, function (restaurants) {
				db.close()
				console.log('Disconnected MongoDB\n')
				res.writeHead(200, { "Content-Type": "text/html" })
				res.write('<html><head><title>Restaurant</title></head>')
				res.write('<body><H1>Restaurants</H1>')
				res.write('<H2>Showing ' + restaurants.length + ' document(s)</H2>')
				res.write('<ol>')
				for (var i in restaurants) {
					var _id = restaurants[i]._id
					res.write('<li><a href="/display?_id=' + _id + '">' + restaurants[i].name + '</a></li>')
				}
				res.write('</ol>')
				res.end('</body></html>')
				return (restaurants)
			})
		})
	}

})

app.get('/display', function (req, res) {
	var _id = req.query._id
	var ObjectId = require('mongodb').ObjectId
	var o_id = new ObjectId(_id)
	MongoClient.connect(mongourl, function (err, db) {
		if (err) throw err
		db.collection("restaurants").findOne({ _id: o_id }, function (err, result) {
			if (!err) {
				if (result) {
					// console.log(result)
					var photoMimetype = 'data:' + result.photoMimetype + ';base64,'
					var photo = new Buffer(result.photo, 'base64')
					db.close()
					res.writeHead(200, { "Content-Type": "text/html" })
					res.write('<html><head><title>' + result.name + '</title></head>')
					res.write('<body><H1>' + result.name + '</H1>')
					res.write('<img src="data:image/jpeg;base64,' + result.photo + '" style="width: 80%; height: 59%; margin: auto; object-fit: contain;"/>')
					res.end('</body></html>')
				} else {
					console.log('no result')
				}
			}
			db.close()
		})
	})
})

function findRestaurants(db, callback) {
	var restaurants = [];
	cursor = db.collection('restaurants').find();
	cursor.each(function (err, doc) {
		assert.equal(err, null);
		if (doc != null) {
			restaurants.push(doc);
		} else {
			callback(restaurants);
		}
	});
}

app.get('/login', function (req, res) {
	res.sendFile(__dirname + '/public/login.html')
})

app.get('/register', function (req, res) {
	res.sendFile(__dirname + '/public/register.html')
})

app.get('/create', function (req, res) {
	if (!req.session.username && !req.session.authenticated) {
		res.redirect('/login')
	} else {
		res.sendFile(__dirname + '/public/create.html')
	}
})

app.post('/login', function (req, res) {
	var usernameInput = req.body.name
	var passwordInput = req.body.password
	var userInfo = { username: usernameInput, password: passwordInput }
	MongoClient.connect(mongourl, function (err, db) {
		if (err) throw err
		if (!usernameInput || !passwordInput) {
			console.log('invalid username or password')
			res.redirect('/')
			return
		}
		db.collection("users").findOne(userInfo, function (err, result) {
			if (!err) {
				if (result) {
					console.log('login success')
					req.session.authenticated = true
					req.session.username = result.username
					res.redirect('/read')
				} else {
					console.log('invalid username or password')
					res.redirect('/')
				}
			}
			db.close()
		})
	})
	// res.redirect('/')
})

app.post('/register', function (req, res) {
	MongoClient.connect(mongourl, function (err, db) {
		if (err) throw err
		var usernameInput = req.body.username
		var passwordInput = req.body.password
		var userInfo = { username: usernameInput, password: passwordInput }
		db.collection("users").findOne({ username: usernameInput }, function (err, result) {
			if (err) throw err
			if (result === null) {
				db.collection("users").insertOne(userInfo, function (err, res) {
					if (err) throw err
					console.log("1 document inserted")
					console.log("account register complete!")
				})
			} else {
				console.log('username existed, please use another one')
			}
			db.close()
		})
	})
})

app.post('/create', function (req, res) {
	if (req.url == '/create' && req.method.toLowerCase() == 'post') {
		var form = new formidable.IncomingForm()
		form.parse(req, function (err, fields, files) {
			// console.log('fields', fields)
			// console.log('files', files)
			mongoose.connect(mongourl)
			var db = mongoose.connection
			var name = fields.name
			var borough = fields.borough
			var cuisine = fields.cuisine
			var street = fields.street
			var building = fields.building
			var zipcode = fields.zipcode
			var lat = fields.lat
			var lon = fields.lon
			var photo

			var filepath = files.photo.path
			if (files.photo.type) {
				var photoMimetype = files.photo.type;
			}
			fs.readFile(filepath, function (err, data) {
				photo = new Buffer(data).toString('base64')
			})

			db.on('error', console.error.bind(console, 'connection error:'))
			db.once('open', function (callback) {
				var Restaurant = mongoose.model('Restaurant', restaurantSchema)
				var newRestaurant = new Restaurant({
					name: name, borough: borough,
					cuisine: cuisine, photo: photo, photoMimetype: photoMimetype, address: [{
						street: street, building: building,
						zipcode: zipcode, coord: [{ lat: lat, lon: lon }]
					}], owner: req.session.username
				})

				newRestaurant.validate(function (err) {
					console.log(err)
				})

				newRestaurant.save(function (err) {
					if (err) throw err
					console.log('new restaurant created!')
					db.close()
					res.redirect('/read')
				})
			})

		})
		return
	}
})

app.get('/logout', function (req, res) {
	req.session = null
	res.redirect('/')
})

app.listen(process.env.PORT || 8099)
