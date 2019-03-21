"use strict";


const express = require("express");
const bodyParser = require("body-parser");
var _ = require("underscore");
var Request = require("request");

const restService = express();



restService.use(
  bodyParser.urlencoded({
    extended: true
  })
);

restService.use(bodyParser.json());

restService.post("/selectAppropriateItemAndPlaceOrder", function(req, res) {
  if(!req.body) return res.sendStatus(400);
  res.setHeader('Content-Type', 'application/json');
  var responseObj = undefined;

  var category = req.body.queryResult.parameters['ItemCategory'];

  var subCategory = req.body.queryResult.parameters['SubCategory'];
  var subCategoryDiet = "diet";

  var subSubCategory = req.body.queryResult.parameters['SubSubCategory'];

  // Searching from top 50 items
  var url = "https://www.samsclub.com/api/node/vivaldi/v1/products/search/?sourceType=1&selectedFilter=all&sortKey=relevance&sortOrder=1&offset=0&limit=30&searchTerm=" + category + "&clubId=6612";

  Request.get(url, (error, response, body) => {
      if(error) {
          return console.dir(error);
      }
      var body = JSON.parse(body);
      var records = body.payload.records;

      // Filter from the top 30 items the ones that have the category name
      var filterRecordsPerCategory = _.filter(records, function(record) {
            var productName = record.productName.toLowerCase();
            return productName.includes(category.toLowerCase());
      });

      if(filterRecordsPerCategory.length == 0) {
              responseObj = {
                  "fulfillmentText": "Sorry, could not find a matching item for your request",
                  "fulfillmentMessages": [
                      {
                          "text": {
                              "text": ["Sorry, could not find a matching item for your request"]
                          }
                      }
                      ],
                      "source": "hackday-service.herokuapp.com"
                      }
       } else {

//            var productNameToIdMap = _.object(_.map(filterRecordsPerCategory, function(record) {
//                   return [record.productName, record.productId]
//                }));
//
//            console.dir(productNameToIdMap);

            var filterRecordsPerSubCategories = undefined;
            if(subCategory.toLowerCase() == subCategoryDiet) {
              filterRecordsPerSubCategories = _.filter(filterRecordsPerCategory, function(record) {
                          var productName = record.productName.toLowerCase();
                          return productName.includes(subCategoryDiet) && productName.includes(subSubCategory.toLowerCase());
                    });
            } else {
              filterRecordsPerSubCategories = _.filter(filterRecordsPerCategory, function(record) {
                                      var productName = record.productName.toLowerCase();
                                      return !productName.includes(subCategoryDiet) && productName.includes(subSubCategory.toLowerCase());
                    });
            }


//            var blah = _.object(_.map(filterRecordsPerSubCategories, function(record) {
//                               return [record.productName, record.productId]
//                            }));
//
//            console.dir(blah);


            if(filterRecordsPerSubCategories.length == 0) {
              responseObj = {
                  "fulfillmentText": "Sorry, could not find a matching item for your request",
                  "fulfillmentMessages": [
                      {
                          "text": {
                              "text": ["Sorry, could not find a matching item for your request"]
                          }
                      }
                      ],
                      "source": "hackday-service.herokuapp.com"
                      }
            } else {
                var itemToOrder = filterRecordsPerSubCategories[0];
                responseObj = {
                              "fulfillmentText": "Sure, Added " + itemToOrder.productName + " to your cart",
                              "fulfillmentMessages": [
                                  {
                                      "text": {
                                          "text": ["Sure, Added " + itemToOrder.productName + " to your cart"]
                                      }
                                  }
                                  ],
                                  "source": "hackday-service.herokuapp.com"
                                  }
            }
       }
      console.dir(responseObj);
      return res.json(responseObj);
  });
});

restService.post("/getFiveTopRatedItems", function(req, res) {
  if(!req.body) return res.sendStatus(400);
  res.setHeader('Content-Type', 'application/json');

  var category = req.body.queryResult.parameters['ItemCategory'];


  /*
  If item is already ordered then give back voice response like baby wipes

  else give back top rated 5 items as card for tomatoes
  */

  var responseObj = {
              "fulfillmentText": "Sure, I have a few options  like banana 1, banana 2, banana 3",
              "fulfillmentMessages": [
                {
                  "quickReplies": {
                                    "title": "Hi, I am responding from web hook",
                                    "quickReplies": [
                                      "banana 1",
                                      "banana 2",
                                      "banana 3"
                                    ]
                  }

                }
              ],
              "source": "hackday-service.herokuapp.com"
  }
  return res.json(responseObj);
});

restService.listen(process.env.PORT || 8000, function() {
  console.log("Server up and listening");
});
