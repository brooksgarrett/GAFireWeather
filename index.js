var alexa = require('alexa-app');
var request = require('request');
var cheerio = require('cheerio');

// Allow this module to be reloaded by hotswap when changed
module.change_code = 1;

// Define an alexa-app
var app = new alexa.app('gafirecondition');

var Conditions = function (station, wind_speed, wind_direction, danger_class_today, danger_class_tomorrow, error) {
    this.station = station;
    this.wind_speed = wind_speed;
    this.wind_direction = wind_direction;
    this.danger_class_today = danger_class_today;
    this.danger_class_tomorrow = danger_class_tomorrow;
    this.error = error;
};

Conditions.prototype.textWindspeed = function () {
    switch (this.wind_speed) {
        case 0: return "Calm";
        case 1: return "NE";
        case 2: return "E";
        case 3: return "SE";
        case 4: return "S";
        case 5: return "SW";
        case 6: return "W";
        case 7: return "NW";
        case 8: return "N";
    }
}

getWeatherConditions = function (station, res, resCallback) {
    console.log("==2== getWeatherConditions ====");
    request('http://weather.gfc.state.ga.us/CURRENT2/NFDRSSUM11.aspx', function (error, response, body) {
            console.log("===3=== Entering request");
            var danger = 1;
            var error = undefined;
            if (!error && response.statusCode == 200) {
                console.log("==2== Good Request");
                $ = cheerio.load(body);
                var stationRow = $(`table table tr:has(td:contains('${station}'))`);
                if (stationRow.length > 0) {
                    if ($("td:contains('Data not')", stationRow).length > 0) {
                        console.log("==2== Data was not available");
                        returnError(new Conditions(station, undefined, undefined, undefined, undefined, "The data wasn't available for that station"), res);
                    } else {
                        var stationConditions = new Conditions(
                            station,
                            $("td", stationRow).eq(6).text(),
                            $("td", stationRow).eq(7).text(),
                            $("td", stationRow).eq(8).text(),
                            $("td", stationRow).eq(10).text(),
                            undefined
                        );
                        console.log("==2== Returning current conditions");
                        resCallback(stationConditions, res);
                    }
                } else {
                    returnError(new Conditions(station, undefined, undefined, undefined, undefined, "That doesn't seem like a valid station. Ask me for a list of stations if you need help."), res);
                }

                
            } else {
                console.log("===3=== badRequest");
                returnError(new Conditions(undefined, undefined, undefined, undefined, undefined, "I could not retreive the data"), res);
            }
        });
};

function returnCurrentWeatherConditions (conditions, res) {
    console.log("===3=== getCurrentWeatherConditions");
    res.say(`The danger class is ${conditions.danger_class_today} in ${conditions.station} today`);
    res.send();
    console.log("===3=== Response sent");
};

function returnFutureWeatherConditions (conditions, res) {
    console.log("===3=== getCurrentWeatherConditions");
    res.say(`The danger class will be ${conditions.danger_class_tomorrow} in ${conditions.station} tomorrow`);
    res.send();
    console.log("===3=== Response sent");
};

function calculateBurnRisk(conditions, day) {
    var risk = '';
    var command = '';
    switch (conditions.danger_class_today.trim()){
        case "1": 
            risk = 'Low';
            command = 'may';
            break;
        case "2": 
            risk = 'Moderate';
            command = 'can';
            break;
        case "3": 
            risk = 'High';
            command = 'should carefully';
            break;
        case "3+": 
            risk = 'High';
            command = 'should not';
            break;
        case "4": 
            risk = 'Very High';
            command = 'are not allowed to';
            break;
        case "4+": 
            risk = 'Very High';
            command = 'are not allowed to';
            break;
        case "5": 
            risk = 'Extreme';
            command = 'are not allowed to';
            break;
        case "5+": 
            risk = 'Extreme';
            command = 'are not allowed to';
            break;
    }
    return `The risk is ${risk} ${day} and you ${command} burn`;
}

function returnSafeToBurn (conditions, res) {
    console.log("===3=== returnSafeToBurn");
    var message = calculateBurnRisk(conditions, 'today');
    res.say(message);
    res.send();
    console.log("===3=== Response sent");
};

function returnSafeToBurnTomorrow (conditions, res) {
    console.log("===3=== returnSafeToBurnTomorrow");
    var message = calculateBurnRisk(conditions, 'tomorrow');
    res.say(message);
    res.send();
    console.log("===3=== Response sent");
};

function returnError (conditions, res) {
    console.log("===3=== An error was defined");
    res.say(`I'm sorry but ${conditions.error}`);
    res.send();
    console.log("===3=== Response sent");
};

app.intent('CurrentConditionsIntent', {
		"slots":{"STATION":"LIST_OF_STATIONS"}
		,"utterances":["{what is|tell me} {the danger class|the fire condition} {for|in} {STATION}{| today}"]
	},function(req,res) {
        console.log('=1= CurrentConditionsIntent ');
        getWeatherConditions(req.slot('STATION'), res, returnCurrentWeatherConditions);
        console.log('=1= Returned ');
		return false;
	}
);

app.intent('NextDayConditionsIntent', {
		"slots":{"STATION":"LIST_OF_STATIONS"}
		,"utterances":["{what is|tell me} {the danger class|the fire condition|the fire danger} {for|in} {STATION} {tomorrow}"]
	},function(req,res) {
        console.log('=1= NextDayConditionsIntent ');
        getWeatherConditions(req.slot('STATION'), res, returnFutureWeatherConditions);
        console.log('=1= Returned ');
		return false;
	}
);

app.intent('SafeToBurnIntent', {
		"slots":{"STATION":"LIST_OF_STATIONS"}
		,"utterances":["{Can|may|should} I burn {for|in|near} {STATION} {|today}", 
            "Is it safe to burn {in|near} {STATION} {|today}"]
	},function(req,res) {
        console.log('=1= SafeToBurnIntent ');
        getWeatherConditions(req.slot('STATION'), res, returnSafeToBurn);
        console.log('=1= Returned ');
		return false;
	}
);

app.intent('SafeToBurnTomorrowIntent', {
		"slots":{"STATION":"LIST_OF_STATIONS"}
		,"utterances":["{Can|may|should} I burn {for|in|near} {STATION} {tomorrow}", 
            "Is it safe to burn {in|near} {STATION} {tomorrow}"]
	},function(req,res) {
        console.log('=1= SafeToBurnTomorrowIntent ');
        getWeatherConditions(req.slot('STATION'), res, returnSafeToBurnTomorrow);
        console.log('=1= Returned ');
		return false;
	}
);

app.intent('ListStationsIntent', {
		"slots":{},
		"utterances":["What stations are available", 
            "List {|all|the} stations"]
	},function(req,res) {
        console.log('=1= ListStationsIntent ');
        res.say('You can say Chatsworth, Dallas, Dawsonville, Sumtner, Watkinsville, Camilla, Americus, Adel, ' + 
        'Byromville, Fort Benning, Washington, Louisville, Brender NFS, Milledgeville, Newnan, Sterling, Waycross, ' + 
        'Baxley, Folkston, Fargo, Eddy Tower, McRae, Metter, Midway, Claxton, Richmond Hill, Taylor Creek, Lawson, ' +
        'or Ft. Stewart');
        console.log('=1= Returned ');
	}
);

app.pre = function(request, response, type) {
  if (request.applicationId != process.env.APPID) {
    // fail ungracefully
    response.fail("Invalid applicationId");
  }
};

module.exports = app;
