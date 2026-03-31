const express = require('express')
const app = express()

app.listen(3000)

app.get('/', (req, res) => {
    res.status(200).json({message: "Hello World"});
    console.log("Server is running");
});

