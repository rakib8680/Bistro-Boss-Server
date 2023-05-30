const express = require('express');
const app = express();
const cors = require('cors')
const port = process.env.PORT || 5000;
require('dotenv').config();
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');



//  middleware 
app.use(express.json());
app.use(cors());

const verifyJWT = (req, res, next) => {
    const authorization = req.headers.authorization;
    if (!authorization) {
        res.status(401).send({ error: true, message: 'unauthorized access' });
    }
    //bearer token
    const token = authorization.split(' ')[1];
    // verify jwt 
    jwt.verify(token, process.env.ACCESS_TOKEN, (err, decoded) => {
        if (err) {
            return res.status(401).send({ error: true, message: 'unauthorized access' })
        }
        req.decoded = decoded;
        next();
    })
};


app.get('/', (req, res) => {
    res.send('Welcome')
})



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.crku76a.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();
        // database 
        const menuCollection = client.db('bistroDB').collection('menu');
        const reviewCollection = client.db('bistroDB').collection('reviews');
        const cartCollection = client.db('bistroDB').collection('carts');
        const usersCollection = client.db('bistroDB').collection('users');

        // JWT 
        app.post('/jwt', (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN, { expiresIn: '1h' })
            res.send(token)
        });

        // verify admin middle ware 
        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email }
            const user = await usersCollection.findOne(query)
            if (user?.role != 'admin') {
                return res.status(403).send({ error: true, message: 'forbidden access' })
            }
            next();
        }

        // menu collection .........................................................................................
        // get menus 
        app.get('/menu', async (req, res) => {
            const result = await menuCollection.find().toArray();
            res.send(result);
        })

        // reviews collection 
        // get reviews 
        app.get('/review', async (req, res) => {
            const result = await reviewCollection.find().toArray();
            res.send(result);
        })


        // cart collection............................................................................................
        // post cart 
        app.post('/carts', async (req, res) => {
            const item = req.body;
            const result = await cartCollection.insertOne(item)
            res.send(result)
        })

        // get cart 
        app.get('/carts', verifyJWT, async (req, res) => {
            const email = req.query.email;
            if (!email) {
                res.send([])
            }

            const decodedEmail = req.decoded.email
            if (email !== decodedEmail) {
                return res.status(403).send({ error: true, message: 'forbidden access' })
            }

            const query = { email: email };
            const result = await cartCollection.find(query).toArray();
            res.send(result)
        })

        // delete from cart 
        app.delete('/carts/:id', async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) };
            const result = await cartCollection.deleteOne(query)
            res.send(result)
        })



        // users collection .....................................................................................
        // add-user  
        app.post('/users', async (req, res) => {
            const user = req.body;
            const query = { email: user.email }
            const existingUser = await usersCollection.findOne(query)
            if (existingUser) {
                return res.send({ message: 'user already exist' })
            }
            const result = await usersCollection.insertOne(user);
            res.send(result);
        });

        // get users
        app.get('/users', verifyJWT,verifyAdmin, async (req, res) => {
            const result = await usersCollection.find().toArray();
            res.send(result)
        });

        // check admin 
        app.get('/users/admin/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;

            if (req.decoded.email !== email) {
                res.send({ admin: false })
            }

            const query = { email: email }
            const user = await usersCollection.findOne(query);
            const result = { admin: user?.role === 'admin' }
            res.send(result)
        })

        // update users 
        app.patch('/users/admin/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const updatedUser = {
                $set: {
                    role: 'admin',
                }
            }
            const result = await usersCollection.updateOne(query, updatedUser)
            res.send(result)
        })



        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);






app.listen(port, () => {
    console.log(`listening on ${port}`)
})