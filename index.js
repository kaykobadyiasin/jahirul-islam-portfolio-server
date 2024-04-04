const express = require('express');
const cors = require('cors');
const SSLCommerzPayment = require('sslcommerz-lts')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const bodyParser = require('body-parser'); // Import body-parser module
const moment = require('moment-timezone');
const { sendMail } = require('./helpers/sendMail');
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
        const blogCollection = client.db('portfolioJahir').collection('blog')
        const featureCollection = client.db('portfolioJahir').collection('feature')
        const contactCollection = client.db('portfolioJahir').collection('contact')


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






        /* blog crud operation start */
        // new blog post 
        app.post('/blog', async (req, res) => {
            const newBlog = req.body;
            console.log(newBlog)

            // Get current date and time in Bangladesh (Dhaka) timezone
            const currentDateTimeDhaka = moment().tz('Asia/Dhaka');

            // Format order_time and order_date
            const up_time = currentDateTimeDhaka.format('h:mm a');
            const up_date = currentDateTimeDhaka.format('MMM D, YYYY');

            // Add up_time and up_date to newBlog
            newBlog.up_time = up_time;
            newBlog.up_date = up_date;

            const result = await blogCollection.insertOne(newBlog);
            res.send(result)
        })

        // get all blog
        app.get('/blog', async (req, res) => {
            const blogs = blogCollection.find();
            const result = await blogs.toArray();
            res.send(result)
        })

        // get specific id blog
        app.get('/blog/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await blogCollection.findOne(query);
            res.send(result)
        })

        // update specific id blog other wise create new blog
        app.put('/blog/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const options = { upsert: true }; // if have this id data update otherwise create new
            const updatedBlog = req.body;

            // Get current date and time in Bangladesh (Dhaka) timezone
            const currentDateTimeDhaka = moment().tz('Asia/Dhaka');

            // Format up_time and up_date
            const up_time = currentDateTimeDhaka.format('h:mm a');
            const up_date = currentDateTimeDhaka.format('MMM D, YYYY');

            const blog = {
                $set: {
                    image: updatedBlog.image,
                    title: updatedBlog.title,
                    details: updatedBlog.details,
                    up_time: up_time, // Add up_time
                    up_date: up_date  // Add up_date
                }
            };

            const result = await blogCollection.updateOne(filter, blog, options);
            res.send(result);
        });

        // delete specific id blog
        app.delete('/blog/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await blogCollection.deleteOne(query);
            res.send(result)
        })
        /* blog crud operation end */






        /* feature crud operation start */
        // new feature post 
        app.post('/feature', async (req, res) => {
            const newFeature = req.body;

            // Get current date and time in Bangladesh (Dhaka) timezone
            const currentDateTimeDhaka = moment().tz('Asia/Dhaka');

            // Format order_time and order_date
            const up_time = currentDateTimeDhaka.format('h:mm a');
            const up_date = currentDateTimeDhaka.format('MMM D, YYYY');

            // Add up_time and up_date to newBlog
            newFeature.up_time = up_time;
            newFeature.up_date = up_date;

            const result = await featureCollection.insertOne(newFeature);
            res.send(result)
        })

        // get all feature
        app.get('/feature', async (req, res) => {
            const features = featureCollection.find();
            const result = await features.toArray();
            res.send(result)
        })

        // get specific id feature
        app.get('/feature/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await featureCollection.findOne(query);
            res.send(result)
        })

        // update specific id feature other wise create new feature
        app.put('/feature/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const options = { upsert: true }; // if have this id data update otherwise create new
            const updatedFeature = req.body;

            // Get current date and time in Bangladesh (Dhaka) timezone
            const currentDateTimeDhaka = moment().tz('Asia/Dhaka');

            // Format up_time and up_date
            const up_time = currentDateTimeDhaka.format('h:mm a');
            const up_date = currentDateTimeDhaka.format('MMM D, YYYY');

            const feature = {
                $set: {
                    image: updatedFeature.image,
                    title: updatedFeature.title,
                    details: updatedFeature.details,
                    up_time: up_time, // Add up_time
                    up_date: up_date  // Add up_date
                }
            };

            const result = await featureCollection.updateOne(filter, feature, options);
            res.send(result);
        });

        // delete specific id feature
        app.delete('/feature/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await featureCollection.deleteOne(query);
            res.send(result)
        })
        /* feature crud operation end */





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



        /* contact crud operation start */

        // get all contact
        app.get('/contact', async (req, res) => {
            const contacts = contactCollection.find();
            const result = await contacts.toArray();
            res.send(result)
        })

         // get specific id contact
         app.get('/contact/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await contactCollection.findOne(query);
            res.send(result)
        })

        // new contact post 
        app.post('/contact', async (req, res) => {
            const newContact = req.body;
            const { name, email, subject, message } = newContact;
            console.log(newContact)
            if (newContact) {
                sendMail('"Kaykobad Yiasin Khan" <kaykobadyiasin@gmail.com>', `"${name}! Kaykobad Khan" <${email}>, "${name}!" <kaykobadyiasin@gmail.com>`, subject, ``,
                    `<body style="font-family: Arial, sans-serif; background-color: #f5f5f5; margin: 0; padding: 8px;">
                <div style="max-width: 600px; margin: 20px auto; padding: 20px; background-color: #F4FBFF; border-radius: 8px; box-shadow: 0 0 10px rgba(0,0,0,0.1);">
                    <h4 style="color: white; background-color: #008EFF; padding: 10px; border-radius: 5px;">Name: ${name}</h4>
                    <p style="color: #333333;">Email: ${email}</p>
                    <p style="color: #333333;">Message: ${message}</p>
                </div>
            </body>`)
            }
            else {
                console.log('not found')
            }

            // Get current date and time in Bangladesh (Dhaka) timezone
            const currentDateTimeDhaka = moment().tz('Asia/Dhaka');

            // Format order_time and order_date
            const up_time = currentDateTimeDhaka.format('h:mm a');
            const up_date = currentDateTimeDhaka.format('MMM D, YYYY');

            // Add up_time and up_date to newBlog
            newContact.up_time = up_time;
            newContact.up_date = up_date;

            const result = await contactCollection.insertOne(newContact);
            res.send(result)
        })


        // update specific id contact other wise create new contact
        app.put('/contact/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const options = { upsert: true }; // if have this id data update otherwise create new
            const updatedContact = req.body;

            // Get current date and time in Bangladesh (Dhaka) timezone
            const currentDateTimeDhaka = moment().tz('Asia/Dhaka');

            // Format up_time and up_date
            const up_time = currentDateTimeDhaka.format('h:mm a');
            const up_date = currentDateTimeDhaka.format('MMM D, YYYY');

            const contact = {
                $set: {
                    image: updatedContact.image,
                    title: updatedContact.title,
                    details: updatedContact.details,
                    up_time: up_time, // Add up_time
                    up_date: up_date  // Add up_date
                }
            };

            const result = await contactCollection.updateOne(filter, contact, options);
            res.send(result);
        });


        // delete specific id contact
        app.delete('/contact/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await contactCollection.deleteOne(query);
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



// root 
app.get('/', (req, res) => {
    res.send('jahir portfolio server is running')
})

app.listen(port, () => {
    console.log(`jahir portfolio server is running on port: ${port}`)
})