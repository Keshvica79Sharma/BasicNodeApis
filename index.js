"use strict";


const express = require("express");
const bodyParser = require("body-parser");
var _ = require("underscore");
var Request = require("request");
const https = require('https')

const restService = express();

var TOPSEARCH = undefined;

restService.use(
  bodyParser.urlencoded({
    extended: true
  })
);

restService.use(bodyParser.json());

restService.post("/selectAppropriateItemOrPlaceOrder", function(req, res) {
  var responseObj = undefined;
  res.setHeader('Content-Type', 'application/json');

  if(!req.body) {
    console.dir("Body Missing");
    responseObj = cannotUnderstand();
    return res.json(responseObj);
  }

  // This will be the follow up content for any top search
  if(req.body.queryResult.intent.displayName == 'OrderItem') {
      var outputContexts = req.body.queryResult.outputContexts;
      var optionObject = _.find(outputContexts, function(cont){ return cont.parameters != undefined; });
      responseObj = orderItem(optionObject.parameters.text);
      return res.json(responseObj);
  }

  var category = req.body.queryResult.parameters['ItemCategory'];
  var subCategory = req.body.queryResult.parameters['SubCategory'];
  var subSubCategory = req.body.queryResult.parameters['SubSubCategory'];

  if(!category) {
    console.dir("Category not present");
    responseObj = cannotUnderstand();
    return res.json(responseObj);
  }

  // Searching from top 30 items
  var url = "https://xxx/api/node/vivaldi/v1/products/search/?sourceType=1&selectedFilter=all&sortKey=relevance&sortOrder=1&offset=0&limit=30&searchTerm=" + category + "&clubId=xxx";

  Request.get(url, (error, response, body) => {
      if(error) {
          console.dir(error);
          responseObj = cannotUnderstand();
          return res.json(responseObj);
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
                            'origin':'https://xxx',
                            'cookie': 'blah'}

                        // Configure the request
                        var options = {
                            url: 'https://xxx/api/node/cartservice/v1/carts/29a73eedf0f85069333a107ba1ca3a17/cartitems?response_groups=cart.medium',
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
                        "fulfillmentText": "Sure, Added " + itemToOrder.productName + " to your sams cart",
                        "fulfillmentMessages": [
                                {
                                    "text": {
                                            "text": ["Sure, Added " + itemToOrder.productName + " to your sams cart"]
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
                responseObj = searchTopThreeItems(category, filterRecordsPerCategory);

            }
       }
      return res.json(responseObj);
  });
});

function cannotUnderstand() {
 return {
                  "fulfillmentText": "Sorry, could not understand, can you say that again?",
                  "fulfillmentMessages": [
                      {
                          "text": {
                              "text": ["Sorry, could not understand, can you say that again?"]
                          }
                      }
                      ],
                      "source": "hackday-service.herokuapp.com"
        };
}

function orderItem(itemToOrder) {
    var addToCart = _.find(TOPSEARCH, function(itemMatch){ return itemMatch.productName == itemToOrder; });
    var productId = addToCart.productId;
    var skuId = addToCart.skuOptions[0].skuId;

    var body = {"payload":{"items":[{"quantity":1,"channel":"club","offerId":{"USItemId": productId,"USVariantId": skuId,"USSellerId":0}}]}};

    // Set the headers
    var headers = {
    'Content-Type': 'application/json',
    'scheme':'https',
    'accept-encoding':'gzip, deflate, br',
    'accept-language':'en-IN,en-GB;q=0.9,en-US;q=0.8,en;q=0.7',
    'origin':'xxx',
    'cookie': 'blah'}

    // Configure the request
    var options = {
        url: 'https://xxxx/api/node/cartservice/v1/carts/29a73eedf0f85069333a107ba1ca3a17/cartitems?response_groups=cart.medium',
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
        console.log("****FAILURE");
        console.log(error);
    }
    })

    return {
        "fulfillmentText": "Sure, Added " + addToCart.productName + " to your sams cart",
            "fulfillmentMessages": [
                {
                    "text": {
                    "text": ["Sure, Added " + addToCart.productName + " to your sams cart"]
                }
            }
        ],
        "source": "hackday-service.herokuapp.com"
    };
};

// Searching top 3
function searchTopThreeItems(category, filterRecordsPerCategory) {
    var topThreeMatches = undefined;

    var itemFlag = "TopRated";
    var topMatches = _.filter(filterRecordsPerCategory, function(record) {
        return record.itemFlag == itemFlag;
    });
    var topThreeMatches = _.filter(topMatches, function(record) {
            return topMatches.indexOf(record) < 3;
    });

    if(topThreeMatches.length == 0) {
        var topThreeMatches = _.filter(filterRecordsPerCategory, function(record) {
                    return filterRecordsPerCategory.indexOf(record) < 3;
            });
    }

    // SETTING FOR FOLLOWUP CONTENT
    TOPSEARCH = topThreeMatches;

    if(topThreeMatches.length == 1) {
        return {
                     "source": "example.com",
                     "payload": {
                                    "google": {
                                      "expectUserResponse": true,
                                      "richResponse": {
                                        "items": [
                                          {
                                            "simpleResponse": {
                                              "textToSpeech": "Sure thing. Here is a list of top three matches for your search. Please select one"
                                            }
                                          }
                                        ]
                                      },
                                      "systemIntent": {
                                        "intent": "actions.intent.OPTION",
                                        "data": {
                                          "@type": "type.googleapis.com/google.actions.v2.OptionValueSpec",
                                          "listSelect": {
                                            "title": category,
                                            "items": [
                                              {
                                                "optionInfo": {
                                                  "key": topThreeMatches[0].productName,
                                                },
                                                "description": "",
                                                "image": {
                                                  "url": "https:" + topThreeMatches[0].listImage,
                                                  "accessibilityText": "first alt"
                                                },
                                                "title": topThreeMatches[0].productName
                                              }
                                            ]
                                          }
                                        }
                                      }
                                    }
                                  }
                   };
    } else if(topThreeMatches.length == 2) {
        return {
                     "source": "example.com",
                     "payload": {
                                    "google": {
                                      "expectUserResponse": true,
                                      "richResponse": {
                                        "items": [
                                          {
                                            "simpleResponse": {
                                              "textToSpeech": "Sure thing. Here is a list of top three matches for your search. Please select one"
                                            }
                                          }
                                        ]
                                      },
                                      "systemIntent": {
                                        "intent": "actions.intent.OPTION",
                                        "data": {
                                          "@type": "type.googleapis.com/google.actions.v2.OptionValueSpec",
                                          "listSelect": {
                                            "title": category,
                                            "items": [
                                              {
                                                "optionInfo": {
                                                  "key": topThreeMatches[0].productName,
                                                },
                                                "description": "",
                                                "image": {
                                                  "url": "https:" + topThreeMatches[0].listImage,
                                                  "accessibilityText": "first alt"
                                                },
                                                "title": topThreeMatches[0].productName
                                              },
                                              {
                                                "optionInfo": {
                                                  "key": topThreeMatches[1].productName
                                                },
                                                "description": "",
                                                "image": {
                                                  "url": "https:" + topThreeMatches[1].listImage,
                                                  "accessibilityText": "second alt"
                                                },
                                                "title": topThreeMatches[1].productName
                                              }
                                            ]
                                          }
                                        }
                                      }
                                    }
                                  }
                   };
    } else {
        return {
                     "source": "example.com",
                     "payload": {
                                    "google": {
                                      "expectUserResponse": true,
                                      "richResponse": {
                                        "items": [
                                          {
                                            "simpleResponse": {
                                              "textToSpeech": "Sure thing. Here is a list of top three matches for your search. Please select one"
                                            }
                                          }
                                        ]
                                      },
                                      "systemIntent": {
                                        "intent": "actions.intent.OPTION",
                                        "data": {
                                          "@type": "type.googleapis.com/google.actions.v2.OptionValueSpec",
                                          "listSelect": {
                                            "title": category,
                                            "items": [
                                              {
                                                "optionInfo": {
                                                  "key": topThreeMatches[0].productName,
                                                },
                                                "description": "",
                                                "image": {
                                                  "url": "https:" + topThreeMatches[0].listImage,
                                                  "accessibilityText": "first alt"
                                                },
                                                "title": topThreeMatches[0].productName
                                              },
                                              {
                                                "optionInfo": {
                                                  "key": topThreeMatches[1].productName
                                                },
                                                "description": "",
                                                "image": {
                                                  "url": "https:" + topThreeMatches[1].listImage,
                                                  "accessibilityText": "second alt"
                                                },
                                                "title": topThreeMatches[1].productName
                                              },
                                              {
                                                "optionInfo": {
                                                    "key": topThreeMatches[2].productName
                                                },
                                                "description": "",
                                                "image": {
                                                 "url": "https:" + topThreeMatches[2].listImage,
                                                 "accessibilityText": "second alt"
                                                 },
                                                 "title": topThreeMatches[2].productName
                                              }
                                            ]
                                          }
                                        }
                                      }
                                    }
                                  }
                   };
    }
};

restService.listen(process.env.PORT || 8000, function() {
  console.log("Server up and listening");
});
