const express = require('express');
const cors = require('cors');
const SSLCommerzPayment = require('sslcommerz-lts')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const bodyParser = require('body-parser'); // Import body-parser module
const moment = require('moment-timezone');
const app = express();
require('dotenv').config()
const port = process.env.PORT || 5000;


// middleware 
app.use(cors());
app.use(express.json())
app.use(bodyParser.urlencoded({ extended: true })); // Parse URL-encoded bodies


// urls
const apiUrl = process.env.API_URL;
const clientUrl = process.env.CLIENT_URL;
// mongodb 
const dbUser = process.env.DB_USER;
const dbpass = process.env.DB_PASS;

const uri = process.env.DB_URI;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

// SSLCommerz Payment 
const store_id = process.env.SSL_STOREID;
const store_passwd = process.env.SSL_PASS;
const is_live = false //true for live, false for sandbox



async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();

        // collections 
        const bookCollection = client.db('portfolioJahir').collection('books')
        const oderCollection = client.db('portfolioJahir').collection('oder')


        /* book order crud operation */

        const trans_id = new ObjectId().toString();

        app.post('/order', async (req, res) => {

            // Get current date and time in Bangladesh (Dhaka) timezone
            const currentDateTimeDhaka = moment().tz('Asia/Dhaka');

            // Format order_time and order_date
            const order_time = currentDateTimeDhaka.format('h:mm a');
            const order_date = currentDateTimeDhaka.format('MMM D, YYYY');

            const book = await bookCollection.findOne({
                _id: new ObjectId(req.body.bookId),
            });
            const order = req.body;

            const data = {
                total_amount: book?.price,
                currency: 'BDT',
                tran_id: trans_id, // use unique tran_id for each api call
                success_url: `${apiUrl}/payment/success/${trans_id}`,
                fail_url: `${apiUrl}/payment/fail/${trans_id}`,
                cancel_url: `${apiUrl}/cancel`,
                ipn_url: `${apiUrl}/ipn`,
                shipping_method: 'Courier',
                product_name: book?.name,
                product_category: 'Electronic',
                product_profile: 'general',
                cus_name: order?.name,
                cus_email: order?.email,
                cus_add1: order?.address,
                cus_add2: 'Dhaka',
                cus_city: 'Dhaka',
                cus_state: order?.state,
                cus_postcode: order?.post,
                cus_country: order?.country,
                cus_phone: order?.phone,
                cus_fax: '01711111111',
                ship_name: 'Customer Name',
                ship_add1: 'Dhaka',
                ship_add2: 'Dhaka',
                ship_city: 'Dhaka',
                ship_state: 'Dhaka',
                ship_postcode: 1000,
                ship_country: 'Bangladesh',
                order_time: order_time,
                order_date: order_date,
            };
            const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live)
            sslcz.init(data).then(apiResponse => {
                // Redirect the user to payment gateway
                let GatewayPageURL = apiResponse.GatewayPageURL
                res.send({ url: GatewayPageURL });


                // final order store database 
                const finalOrder = {
                    book,
                    paidStatus: false,
                    tranjectionId: trans_id,
                    data,
                }
                const result = oderCollection.insertOne(finalOrder);
                console.log('Redirecting to: ', GatewayPageURL)
            });


            // payment success route
            app.post("/payment/success/:transId", async (req, res) => {
                const result = await oderCollection.updateOne(
                    { tranjectionId: req.params.transId },
                    {
                        $set: {
                            paidStatus: true,
                        },
                    }
                );
                if (result.modifiedCount > 0) {
                    res.redirect(`${clientUrl}/payment/success/${req.params.transId}`)
                }
            })

            // payment fail route
            app.post("/payment/fail/:transId", async (req, res) => {
                const result = await oderCollection.deleteOne({
                    tranjectionId: req.params.transId
                });
                if (result.deletedCount) {
                    res.redirect(`${clientUrl}/payment/fail/${req.params.transId}`)
                }
            })

        })


        /* book crud operation start */
        // new book post 
        app.post('/book', async (req, res) => {
            const newBook = req.body;
            console.log(newBook)
            const result = await bookCollection.insertOne(newBook);
            res.send(result)
        })

        // get all book
        app.get('/book', async (req, res) => {
            const books = bookCollection.find();
            const result = await books.toArray();
            res.send(result)
        })

        // get specific id book
        app.get('/book/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await bookCollection.findOne(query);
            res.send(result)
        })

        // update specific id book other wise create new book
        app.put('/book/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const options = { upsert: true } // if have this id data upadate other wise create new
            const updatedBook = req.body;
            const book = {
                $set: {
                    image: updatedBook.image,
                    name: updatedBook.name,
                    price: updatedBook.price,
                    author: updatedBook.author,
                    review: updatedBook.review,
                    details: updatedBook.details,
                }
            }

            const result = await bookCollection.updateOne(filter, book, options);
            res.send(result)
        })

        // delete specific id book
        app.delete('/book/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await bookCollection.deleteOne(query);
            res.send(result)
        })
        /* book crud operation end */



        /* Order crud operation start */
        // new order post 
        // app.post('/book', async (req, res) => {
        //     const newBook = req.body;
        //     console.log(newBook)
        //     const result = await bookCollection.insertOne(newBook);
        //     res.send(result)
        // })

        // get all order
        app.get('/order', async (req, res) => {
            const orders = oderCollection.find();
            const result = await orders.toArray();
            res.send(result)
        })

        // get specific id order
        app.get('/order/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await bookCollection.findOne(query);
            res.send(result)
        })

        // update specific id order other wise create new order
        app.put('/order/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const options = { upsert: true } // if have this id data upadate other wise create new
            const updatedBook = req.body;
            const book = {
                $set: {
                    image: updatedBook.image,
                    name: updatedBook.name,
                    price: updatedBook.price,
                    author: updatedBook.author,
                    review: updatedBook.review,
                    details: updatedBook.details,
                }
            }

            const result = await bookCollection.updateOne(filter, book, options);
            res.send(result)
        })

        // delete specific id order
        app.delete('/order/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await bookCollection.deleteOne(query);
            res.send(result)
        })
        /* order crud operation end */


        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);



// root 
app.get('/', (req, res) => {
    res.send('jahir portfolio server is running')
})

app.listen(port, () => {
    console.log(`jahir portfolio server is running on port: ${port}`)
})