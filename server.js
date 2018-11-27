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

var SECRETKEY1 = 'I GO TO BY BUS'
var SECRETKEY2 = 'XYZ'

app.set('view engine', 'ejs')

app.use(session({
	name: 'session',
	keys: [SECRETKEY1, SECRETKEY2]
}))
app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())
app.use(express.static('public'))

app.get('/', function (req, res) {
	console.log(req.session)
	if (!req.session.authenticated) {
		res.redirect('/login')
	} else {
		res.status(200)
		// res.render('secrets', { name: req.session.username })
		res.redirect('/read')
	}
})

app.get('/read', function (req, res) {
	console.log(req.session)
	if (!req.session.authenticated) {
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
				res.write('<body><h1>Restaurants</h1>')
				res.write('<h2>User: ' + req.session.username + '</h2>')
				res.write('<h2>Showing ' + restaurants.length + ' document(s)</h2>')
				res.write('<a href="/create"><button>Create New Restaurant</button></a>')
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
					console.log(result)
					console.log(typeof result)
					// var photoMimetype = 'data:' + result.photoMimetype + ';base64,'
					// var photo = new Buffer(result.photo, 'base64')
					db.close()
					res.writeHead(200, { "Content-Type": "text/html" })
					res.write('<html><head><title>' + result.name + '</title></head>')
					res.write('<body><H1>' + result.name + '</H1>')
					if (result.photoMimetype.indexOf('application/') == -1) {
						res.write('<img src="data:image/jpeg;base64,' + result.photo + '" style="width: 90%; height: 60%; margin: auto; object-fit: contain;"/><br>')
					}
					res.write('<p>Borough: ' + result.borough + '</p>')
					res.write('<p>Cuisine: ' + result.cuisine + '</p>')
					res.write('<p>Street: ' + result.address[0].street + '</p>')
					res.write('<p>Building: ' + result.address[0].building + '</p>')
					res.write('<p>Zipcode: ' + result.address[0].zipcode + '</p>')
					if ((result.address[0].coord[0].lat !== null) || (result.address[0].coord[0].lon !== null)) {
						res.write('<p>GPS Lat: ' + result.address[0].coord[0].lat + '</p>')
						res.write('<p>GPS Lon: ' + result.address[0].coord[0].lon + '</p>')
						// res.write('<p><a href="/map?_id="' + result._id + '"><button>Google Map</button></a>')
						// TODO: google map button not appearing
						// console.log(result.address[0].coord[0].lat, result.address[0].coord[0].lon)
						res.write('<a href="/map?lat=' + result.address[0].coord[0].lat + '&lon=' + result.address[0].coord[0].lon + '"><button>Google Map</button></a>')
					}
					res.write('<p>Created by: ' + result.owner + '</p>')
					res.write('<div style="display: flex; justify-content: space-around; width: 25%;"><a href=""><button>Rate</button></a>')
					res.write('<a href="/edit?_id=' + result._id + '"><button>Edit</button></a>')
					res.write('<a href="/delete?_id=' + result._id + '"><button>Delete</button></a>')
					res.write('<a href="/read"><button>Go back</button></a>')
					res.end('</body></html>')
				} else {
					console.log('no result')
				}
			}
			db.close()
		})
	})
})

app.get('/map', function (req, res){
	res.render('gmap', { 
		lat: req.query.lat, 
		lon: req.query.lon 
	})	
	res.end()
})

app.get('/delete', function (req, res) {
	var _id = req.query._id
	var ObjectId = require('mongodb').ObjectId
	var o_id = new ObjectId(_id)
	MongoClient.connect(mongourl, function (err, db) {
		if (err) throw err
		db.collection("restaurants").remove({ _id: o_id }, function (err, result) {
			if (!err) {
				if (result) {
					console.log('delete success!')
					res.writeHead(200, { "Content-Type": "text/html" })
					res.write('<html><head><title>' + 'delete' + '</title></head>')
					res.write('<body><H1>' + 'delete success!' + '</H1>')
					res.write('<a href="/read"><button>Go back home</button></a>')
					res.end('</body></html>')
				} else {
					console.log('no result')
					res.writeHead(200, { "Content-Type": "text/html" })
					res.write('<html><head><title>' + 'delete' + '</title></head>')
					res.write('<body><H1>' + 'delete failed!' + '</H1>')
					res.write('<a href="/read"><button>Go back home</button></a>')
					res.end('</body></html>')
				}
			}
			db.close()
		})
	})
})

app.get('/edit', function (req, res) {
	var _id = req.query._id
	var ObjectId = require('mongodb').ObjectId
	var o_id = new ObjectId(_id)
	MongoClient.connect(mongourl, function (err, db) {
		if (err) throw err
		db.collection("restaurants").findOne({ _id: o_id }, function (err, result) {
			if (!err) {
				if (result) {
					// console.log(result)
					// var photoMimetype = 'data:' + result.photoMimetype + ';base64,'
					// var photo = new Buffer(result.photo, 'base64')
					db.close()
					res.writeHead(200, { "Content-Type": "text/html" })
					res.write('<html><head><title>' + result.name + '</title></head>')
					res.write('<body><H1>' + 'Edit ' + result.name + '</H1>')
					res.write('<form action="/edit" enctype="multipart/form-data" method="post">')
					res.write('name: <input type="text" name="name" value="' + result.name + '"><br>')
					res.write('borough: <input type="text" name="name" value="' + result.borough + '"><br>')
					res.write('borough: <input type="text" name="borough" value="' + result.borough + '"><br>')
					res.write('cuisine: <input type="text" name="cuisine" value="' + result.cuisine + '"><br>')
					res.write('street: <input type="text" name="street" value="' + result.address[0].street + '"><br>')
					res.write('building: <input type="text" name="building" value="' + result.address[0].building + '"><br>')
					res.write('zipcode: <input type="text" name="zipcode" value="' + result.address[0].zipcode + '"><br>')
					res.write('GPS Coordinates (Lat.): <input type="text" name="lat" value="' + result.address[0].coord[0].lat + '"><br>')
					res.write('GPS Coordinates (Lon.): <input type="text" name="lon" value="' + result.address[0].coord[0].lon + '"><br>')
					if (result.photo) {
						res.write('<img src="data:image/jpeg;base64,' + result.photo + '" style="width: 90%; height: 60%; margin: auto; object-fit: contain;"/><br>')
					}
					res.write('<a href="edit?_id' + result._id + '"><button>Save</button></a>')
					res.write('</form>')
					res.end('</body></html>')
				} else {
					console.log('no result')
				}
			}
			db.close()
		})
	})
})

// TODO: Complete edit post function
app.post('/edit', function (req, res) {
	var _id = req.query._id
	var ObjectId = require('mongodb').ObjectId
	var o_id = new ObjectId(_id)
	console.log('post /edit')
	MongoClient.connect(mongourl, function (err, db) {
		if (err) throw err
		// TODO: Check req.session.username = document owner
		db.collection('restaurants').update(
			{ _id: o_id },
			{
			   name: 'test',
			},
			{ upsert: true },
			function (err, result) {
				if (err) throw err;
				console.log(result);
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
		if (!usernameInput) {
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
			var borough
			if ((fields.borough == undefined) || (fields.borough == null) || (fields.borough == '')) {
				borough = ''	
			} else {
				borough = fields.borough
			}
			// var borough = fields.borough
			var cuisine
			if ((fields.cuisine == undefined) || (fields.cuisine == null) || (fields.cuisine == '')) {
				cuisine = ''	
			} else {
				cuisine = fields.cuisine
			}
			// var cuisine = fields.cuisine
			var street
			if ((fields.street == undefined) || (fields.street == null) || (fields.street == '')) {
				street = ''	
			} else {
				street = fields.street
			}
			// var street = fields.streettreet
			var building
			if ((fields.building == undefined) || (fields.building == null) || (fields.building == '')) {
				building = ''	
			} else {
				building = fields.building
			}
			// var building = fields.building
			var zipcode
			if ((fields.zipcode == undefined) || (fields.zipcode == null) || (fields.zipcode == '')) {
				zipcode = ''	
			} else {
				zipcode = fields.zipcode
			}
			// var zipcode = fields.zipcode
			var lat
			// if ((fields.lat == undefined) || (fields.lat == null) || (fields.lat == '')) {
			// 	lat = 0
			// } else {
			// 	lat = fields.lat
			// }
			var lon
			// if ((fields.lon == undefined) || (fields.lon == null) || (fields.lon == '')) {
			// 	lon = 0
			// } else {
			// 	lon = fields.lon
			// }
			var lat = fields.lat
			var lon = fields.lon
			var photo
			
			if (files.photo) {
				var filepath = files.photo.path
				if (files.photo.type) {
					var photoMimetype = files.photo.type;
				}
				fs.readFile(filepath, function (err, data) {
					photo = new Buffer(data).toString('base64')
				})
			}

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
