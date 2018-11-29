//TODO: LIST:
// Search 
// RESTful Services

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
				res.write('<h2>User: ' + req.session.username + '<a href="/logout"><button>Logout</button></a>' + '</h2>')
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
					// var photoMimetype = 'data:' + result.photoMimetype + ';base64,'
					// var photo = new Buffer(result.photo, 'base64')
					db.close()
					res.writeHead(200, { "Content-Type": "text/html" })
					res.write('<html><head><title>' + result.name + '</title></head>')
					res.write('<body><H1>' + result.name + '</H1>')
					if (result.photo) {
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
						// console.log(result.address[0].coord[0].lat, result.address[0].coord[0].lon)
						res.write('<a href="/map?lat=' + result.address[0].coord[0].lat + '&lon=' + result.address[0].coord[0].lon + '"><button>Google Map</button></a>')
					}
					if(result.grades.length > 0) {
						res.write('<p>Rating:</p>')
						res.write('<ol>')
						for (var i=0; i < result.grades.length; i++){
							res.write('<li>' + result.grades[i].user + ' (' + result.grades[i].score + ')</li>')
						}
						res.write('</ol>')
					}
					res.write('<p>Created by: ' + result.owner + '</p>')
					res.write('<div style="display: flex; justify-content: space-around; width: 25%;">')
					res.write('<a href="/rate?_id=' + result._id + '&rater=' + req.session.username + '"><button>Rate</button></a>')
					res.write('<a href="/edit?_id=' + result._id + '"><button>Edit</button></a>')
					res.write('<a href="/delete?_id=' + result._id + '"><button>Delete</button></a>')
					res.write('<a href="/read"><button>Go back</button></a>')
					res.write('</div>')
					res.end('</body></html>')
				} else {
					console.log('no result')
				}
			}
			db.close()
		})
	})
})

app.get('/rate', function (req,res) {
	var _id = req.query._id
	var ObjectId = require('mongodb').ObjectId
	var o_id = new ObjectId(_id)
	MongoClient.connect(mongourl, function (err, db) {
		if (err) throw err
		db.collection("restaurants").findOne({ _id: o_id }, function (err, result) {
			if (!err) {
				if (result) {
					var gradesArr = result.grades
					db.close()
					// console.log(gradesArr)
					if (gradesArr.length == 0) {
						res.writeHead(200, { "Content-Type": "text/html" })
						res.write('<html><head><title>Rate</title></head>')
						res.write('<body><H1>Rate</H1>')
						res.write('<form action="/rate?_id=' + _id + '&rater=' + req.session.username + '"' + 'enctype="multipart/form-data" method="post">')
						res.write('<label for="rate">Score (1-10):</label>')
						res.write('<input type="number" id="rate" name="rate" min="1" max="10">')
						res.write('<input type="submit" value="Rate">')
						res.write('</form>')
						res.end('</body></html>')
					}
					else {
						// console.log('gradesArr', gradesArr)
						for (var i = 0; i < gradesArr.length; i++){
							if (gradesArr[i].user == req.session.username) {
								res.writeHead(200, { "Content-Type": "text/html" })
								res.write('<html><head><title>' + 'rated before' + '</title></head>')
								res.write('<body><H1>' + 'You can only rate for once!' + '</H1>')
								res.write('<a href="/read"><button>Go back home</button></a>')	
								res.end('</body></html>')
							} else {
								res.writeHead(200, { "Content-Type": "text/html" })
								res.write('<html><head><title>Rate</title></head>')
								res.write('<body><H1>Rate</H1>')
								res.write('<form action="/rate?_id=' + _id + '&rater=' + req.session.username + '"' + 'enctype="multipart/form-data" method="post">')
								res.write('<label for="rate">Score (1-10):</label>')
								res.write('<input type="number" id="rate" name="rate" min="1" max="10">')
								res.write('<input type="submit" value="Rate">')
								res.write('</form>')
								res.end('</body></html>')
							}
						}
					}
 				} else {
					console.log('no result')
					res.writeHead(200, { "Content-Type": "text/html" })
					res.write('<html><head><title>' + 'no result' + '</title></head>')
					res.write('<body><H1>' + 'no result!' + '</H1>')
					res.write('<a href="/read"><button>Go back home</button></a>')
					res.end('</body></html>')
				}
			}
			db.close()
		})
	})
})

app.post('/rate', function (req, res) {
	var _id = req.query._id
	var ObjectId = require('mongodb').ObjectId
	var o_id = new ObjectId(_id)
	var form = new formidable.IncomingForm()
	var rate
	form.parse(req, function (err, fields) {
		rate = fields.rate
	})
	MongoClient.connect(mongourl, function (err, db) {
		if (err) throw err
		var gradeObj = {}
		gradeObj.user = req.query.rater
		gradeObj.score = rate

		db.collection("restaurants").update({ _id: o_id },  { $push: { grades: gradeObj }}, function(err, result){
			if (err) {
				console.log('Error updating object: ' + err);
				res.send({'error':'An error has occurred'});
			} else {
				console.log('rating success!');
				// res.send(result);
				var redirectURL = '/display?_id=' + _id
				res.redirect(redirectURL)
			}
			db.close()
		})
	})
})

app.get('/map', function (req, res) {
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
		findRestaurantsWithCriteria(db, o_id, function(restaurant) {
			if (restaurant[0].owner == req.session.username) {
				db.collection("restaurants").remove({ _id: o_id })
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
					db.close()
					res.writeHead(200, { "Content-Type": "text/html" })
					res.write('<html><head><title>' + result.name + '</title></head>')
					res.write('<body><H1>' + 'Edit ' + result.name + '</H1>')
					res.write('<form action="/edit?_id=' + result._id  + '"' + 'enctype="multipart/form-data" method="post">')
					res.write('name: <input type="text" name="name" value="' + result.name + '"><br>')
					res.write('borough: <input type="text" name="borough" value="' + result.borough + '"><br>')
					res.write('cuisine: <input type="text" name="cuisine" value="' + result.cuisine + '"><br>')
					res.write('street: <input type="text" name="street" value="' + result.address[0].street + '"><br>')
					res.write('building: <input type="text" name="building" value="' + result.address[0].building + '"><br>')
					res.write('zipcode: <input type="text" name="zipcode" value="' + result.address[0].zipcode + '"><br>')
					if (result.address[0].coord[0].lat == null) {
						res.write('GPS Coordinates (Lat.): <input type="text" name="lat" value="' + "" + '"><br>')	
					} else {
						res.write('GPS Coordinates (Lat.): <input type="text" name="lat" value="' + result.address[0].coord[0].lat + '"><br>')
					}

					if (result.address[0].coord[0].lon == null) {
						res.write('GPS Coordinates (Lon.): <input type="text" name="lon" value="' + "" + '"><br>')	
					} else {
						res.write('GPS Coordinates (Lon.): <input type="text" name="lon" value="' + result.address[0].coord[0].lon + '"><br>')
					}
					res.write('Photo: <input type="file" name="photo"><br>')
					res.write('<input type="submit" value="Save">')
					res.write('</form>')
					res.end('</body></html>')
				} else {
					console.log('no result')
					res.writeHead(200, { "Content-Type": "text/html" })
					res.write('<html><head><title>' + error + '</title></head>')
					res.write('<body><H1>Error!</H1>')
					res.end('</body></html>')
				}
			}
			db.close()
		})
	})
})

app.post('/edit', function (req, res) {
	var _id = req.query._id
	var ObjectId = require('mongodb').ObjectId
	var o_id = new ObjectId(_id)

	if (req.url.startsWith('/edit') && req.method.toLowerCase() == 'post') {
		var form = new formidable.IncomingForm()
		form.parse(req, function (err, fields, files) {
			if(err){ console.log(err) }
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
			var photo = ""
			var filename = files.photo.path
			var photoMimetype = ""

			if (files.photo.type) {
				photoMimetype = files.photo.type;
			}

			if (photoMimetype != 'application/octet-stream') {
				fs.readFile(filename, function (err, data) {
					photo = new Buffer(data).toString('base64');
				})
			}

			db.on('error', console.error.bind(console, 'connection error:'))
			db.once('open', function (callback) {
				var Restaurants = mongoose.model('Restaurants', restaurantSchema)
				if (photo == null || photo == '' || photo == undefined) {
					console.log('photo no need to update')
					Restaurants.updateOne({_id: o_id}, 
						{$set:{name: name, borough: borough,
						cuisine: cuisine, 
						photoMimetype: photoMimetype,
						address: [{
							street: street, 
							building: building,
							zipcode: zipcode, 
							coord: [{ lat: lat, lon: lon }]
						}]
					}}, 
					function(err){			
						if(err){
							console.log(err)
							res.writeHead(200, { "Content-Type": "text/html" })
							res.write('<html><head><title>' + 'error' + '</title></head>')
							res.write('<body><H1>Error!</H1>')
							res.end('</body></html>')
						}
						res.redirect('/display?_id='+ _id)
						console.log("Update Completed!")
					});

				} else{
					Restaurants.updateOne({_id: o_id}, 
						{$set:{name: name, borough: borough,
						cuisine: cuisine, 
						photoMimetype: photoMimetype, 
						photo: photo, 
						address: [{
							street: street, 
							building: building,
							zipcode: zipcode, 
							coord: [{ lat: lat, lon: lon }]
						}]
					}}, 
					function(err){			
						if(err){
							console.log(err)
							res.writeHead(200, { "Content-Type": "text/html" })
							res.write('<html><head><title>' + 'error' + '</title></head>')
							res.write('<body><H1>Error!</H1>')
							res.end('</body></html>')
						}
						res.redirect('/display?_id='+ _id)
						console.log("Update Success!\n");
					});					
				}
			})
		})
		return
	}
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

function findRestaurantsWithCriteria(db, criteria, callback) {
	var restaurants = [];
	cursor = db.collection('restaurants').find(criteria);
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
	res.redirect('/')
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
			var cuisine
			if ((fields.cuisine == undefined) || (fields.cuisine == null) || (fields.cuisine == '')) {
				cuisine = ''
			} else {
				cuisine = fields.cuisine
			}
			var street
			if ((fields.street == undefined) || (fields.street == null) || (fields.street == '')) {
				street = ''
			} else {
				street = fields.street
			}
			var building
			if ((fields.building == undefined) || (fields.building == null) || (fields.building == '')) {
				building = ''
			} else {
				building = fields.building
			}
			var zipcode
			if ((fields.zipcode == undefined) || (fields.zipcode == null) || (fields.zipcode == '')) {
				zipcode = ''
			} else {
				zipcode = fields.zipcode
			}
			var lat = fields.lat
			var lon = fields.lon
			var photo
			
			console.log('files.photo: ',files.photo)

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

app.get('/name/:name', function (req, res) {
	var criteria = {name : req.params.name}

	MongoClient.connect(mongourl, function (err, db) {
		if (err) throw err
		findRestaurantsWithCriteria(db, criteria, function(restaurant) {
			if (restaurant.length > 0) {
				res.status(200).json(restaurant).end
			} else {
				res.status(200).json({}).end
			}
			db.close()
		})
	})
})

app.get('/logout', function (req, res) {
	req.session = null
	res.redirect('/')
})

app.listen(process.env.PORT || 8099)
