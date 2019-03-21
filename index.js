"use strict";


const express = require("express");
const bodyParser = require("body-parser");
var _ = require("underscore");
var Request = require("request");
const https = require('https')

const restService = express();



restService.use(
  bodyParser.urlencoded({
    extended: true
  })
);

restService.use(bodyParser.json());

restService.post("/selectAppropriateItemOrPlaceOrder", function(req, res) {
  if(!req.body) return res.sendStatus(400);

  res.setHeader('Content-Type', 'application/json');

  var responseObj = undefined;

  var category = req.body.queryResult.parameters['ItemCategory'];
  var subCategory = req.body.queryResult.parameters['SubCategory'];
  var subSubCategory = req.body.queryResult.parameters['SubSubCategory'];
  if(!category) return res.sendStatus(400);

  // Searching from top 30 items
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

            if(subSubCategory != undefined && subCategory != undefined) {
                    /*
                    Category, sub category and sub sub category is defined, lets find the match and add to cart
                    */

                    var filterRecordsPerSubCategories = undefined;
                    var subCategoryDiet = "diet";

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
                        var productId = itemToOrder.productId;
                        var skuId = itemToOrder.skuOptions[0].skuId;

                        var body = {"payload":{"items":[{"quantity":1,"channel":"club","offerId":{"USItemId": productId,"USVariantId": skuId,"USSellerId":0}}]}};


                        // Set the headers
                        var headers = {
                            'Content-Type': 'application/json',
                            'scheme':'https',
                            'accept-encoding':'gzip, deflate, br',
                            'accept-language':'en-IN,en-GB;q=0.9,en-US;q=0.8,en;q=0.7',
                            'origin':'https://www.samsclub.com',
                            'cookie': 'JSESSIONID=8B45821873B9EBF74EE9D481D44F2162.estoreapp-44277956-16-70642835'}

                        // Configure the request
                        var options = {
                            url: 'https://www.samsclub.com/api/node/cartservice/v1/carts/800f6c9d685e3dbb7b5442f101781d2d/cartitems?response_groups=cart.medium',
                            port: 443,
                            method: 'POST',
                            headers: headers,
                            body: JSON.stringify(body)
                        }

                        // Start the request
                        Request(options, function (error, response, body) {
                            if (!error && response.statusCode == 200) {
                                // Print out the response body
                                console.log("****SUCESS");
                                console.log(body)
                            } else {
                                console.log("****fail");
                                console.log(error);
                            }
                        })

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
            } else {
                /*
                Only category and sub category is defined, lets pull out history or top 5 items
                */
                responseObj = searchHistoryOrTopItems(category, filterRecordsPerCategory);

            }
       }
      return res.json(responseObj);
  });
});

function searchHistoryOrTopItems(category, filterRecordsPerCategory) {
    var itemFlag = "TopRated";
    var topMatches = _.filter(filterRecordsPerCategory, function(record) {
        return record.itemFlag == itemFlag;
    });
    var topFiveMatches = _.filter(topMatches, function(record) {
            return topMatches.indexOf(record) < 5;
    });

    return {
             "fulfillmentText": "This is a text response",
             "fulfillmentMessages": [
               {
                 "card": {
                   "title": "card title",
                   "subtitle": "card text",
                   "imageUri": "https://assistant.google.com/static/images/molecule/Molecule-Formation-stop.png",
                   "buttons": [
                     {
                       "text": "button text",
                       "postback": "https://assistant.google.com/"
                     }
                   ]
                 }
               }
             ],
                "source": "example.com",
                "payload": {
                  "google": {
                    "expectUserResponse": true,
                    "richResponse": {
                      "items": [
                        {
                          "simpleResponse": {
                            "textToSpeech": "this is a simple response"
                          }
                        }
                      ]
                    }
                  },
                  "facebook": {
                    "text": "Hello, Facebook!"
                  },
                  "slack": {
                    "text": "This is a text response for Slack."
                  }
                }
           };

};

restService.listen(process.env.PORT || 8000, function() {
  console.log("Server up and listening");
});
