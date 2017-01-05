var alexa = require('alexa-app');
var request = require('request');
var cheerio = require('cheerio');
var FuzzySet = require('fuzzyset.js');

// Allow this module to be reloaded by hotswap when changed
module.change_code = 1;

// Define an alexa-app
var app = new alexa.app('gafirecondition');

const STATIONS = ['Chatsworth', 'Dallas', 'Dawsonville', 'Sumtner', 'Watkinsville', 'Camilla', 'Americus', 'Adel',
'Byromville', 'Fort Benning', 'Washington', 'Louisville', 'Brender NFS', 'Milledgeville', 'Newnan', 'Sterling', 'Waycross',
'Baxley', 'Folkston', 'Fargo', 'Eddy Tower', 'McRae', 'Metter', 'Midway', 'Claxton', 'Richmond Hill', 'Taylor Creek', 'Lawson',
'Ft. Stewart'];

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

function findStation (station) {
    debugLog(this.name, `Received |${station}|`);
    f = FuzzySet(STATIONS);
    bestMatch = f.get(station);
    if (bestMatch == null) {
        return undefined;
    }
    if (bestMatch[0][0] > 0.4){
        return bestMatch[0][1];
    } else {
        return undefined;
    };
};

function getWeatherConditions (heardStation, res, resCallback) {
    debugLog(this.name, 'Start');
    if (typeof(heardStation) === 'undefined'){
        debugLog(this.name, 'heardStation undefined. Missing slot from intent?');
        returnError(new Conditions(station, undefined, undefined, undefined, undefined, "No station was provided. Ask me for a list of stations if you need help."), res);
    }
    station = findStation(heardStation);
    if (typeof(station) === 'undefined'){
        debugLog(this.name, 'Fuzzy returned undefined');
        returnError(new Conditions(station, undefined, undefined, undefined, undefined, "That doesn't seem like a valid station. Ask me for a list of stations if you need help."), res);
    }
    request('http://weather.gfc.state.ga.us/CURRENT2/NFDRSSUM11.aspx', function (error, response, body) {
            debugLog(this.name, 'Starting async request');
            var danger = 1;
            var error = undefined;
            if (!error && response.statusCode == 200) {
                debugLog(this.name, 'Valid response received');
                $ = cheerio.load(body);
                var stationRow = $(`table table tr:has(td:contains('${station}'))`);
                if (stationRow.length > 0) {
                    if ($("td:contains('Data not')", stationRow).length > 0) {
                        debugLog(this.name, `Data not available for |${station}`);
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
                        debugLog(this.name, "Done and returning conditions");
                        resCallback(stationConditions, res);
                    }
                } else {
                    debugLog(this.name, "Station wasn't valid");
                    returnError(new Conditions(station, undefined, undefined, undefined, undefined, "That doesn't seem like a valid station. Ask me for a list of stations if you need help."), res);
                }

                
            } else {
                debugLog(this.name, "Bad response received");
                returnError(new Conditions(undefined, undefined, undefined, undefined, undefined, "I could not retreive the data"), res);
            }
        });
};

function debugLog(func, msg) {
    if (process.env.DEBUG) {
        console.log(`${func} | ${msg}`);
    }
}

function returnCurrentWeatherConditions (conditions, res) {
    debugLog(this.name, 'Start');
    res.say(`The danger class is ${conditions.danger_class_today} in ${conditions.station} today`);
    res.send();
    debugLog(this.name, 'Done');
};

function returnFutureWeatherConditions (conditions, res) {
    debugLog(this.name, 'Start');
    res.say(`The danger class will be ${conditions.danger_class_tomorrow} in ${conditions.station} tomorrow`);
    res.send();
    debugLog(this.name, 'Done');
};

function calculateBurnRisk(conditions, day) {
    debugLog(this.name, 'Start with ${conditions}|${day}');
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
        case "3-":
        case "3": 
            risk = 'High';
            command = 'should carefully';
            break;
        case "3+": 
            risk = 'High';
            command = 'should not';
            break;
        case "4-":
        case "4": 
            risk = 'Very High';
            command = 'are not allowed to';
            break;
        case "4+": 
            risk = 'Very High';
            command = 'are not allowed to';
            break;
        case "5-":
        case "5": 
            risk = 'Extreme';
            command = 'are not allowed to';
            break;
        case "5+": 
            risk = 'Extreme';
            command = 'are not allowed to';
            break;
    }
    debugLog(this.name, 'Done with ${risk}|${command}');
    return `The risk is ${risk} ${day} and you ${command} burn`;
}

function returnSafeToBurn (conditions, res) {
    debugLog(this.name, 'Start');
    var message = calculateBurnRisk(conditions, 'today');
    res.say(message);
    res.send();
    debugLog(this.name, 'Done');
};

function returnSafeToBurnTomorrow (conditions, res) {
    debugLog(this.name, 'Start');
    var message = calculateBurnRisk(conditions, 'tomorrow');
    res.say(message);
    res.send();
    debugLog(this.name, 'Done');
};

function returnError (conditions, res) {
    debugLog(this.name, 'Start');
    res.say(`I'm sorry but ${conditions.error}`);
    res.send();
    debugLog(this.name, 'Done');
};

app.launch(function(req, res) {
    res.say("Try telling fire report what to do instead of opening it");
});

app.intent('CurrentConditionsIntent', {
		"slots":{"STATION":"LIST_OF_STATIONS"}
		,"utterances":[
            "{what is|tell me|for} the {report|conditions|danger class|fire condition} {for|in} {-|STATION}{| today}",
            "{what is|tell me|for} {|today|todays} {|the} {danger class|fire condition|fire danger} {for|in} {-|STATION}"]
	},function(req,res) {
        debugLog(this.name, 'Start');
        getWeatherConditions(req.slot('STATION'), res, returnCurrentWeatherConditions);
        debugLog(this.name, 'Done');
		return false;
	}
);

app.intent('NextDayConditionsIntent', {
		"slots":{"STATION":"LIST_OF_STATIONS"}
		,"utterances":[
            "{what is|tell me|for} {the} {report|conditions|danger class|fire condition} {for|in} {-|STATION} {tomorrow}",
            "{what is|tell me|for} {tomorrow|tomorrows} {danger class|fire condition|fire danger} {for|in} {-|STATION}" ]
	},function(req,res) {
        debugLog(this.name, 'Start');
        getWeatherConditions(req.slot('STATION'), res, returnFutureWeatherConditions);
        debugLog(this.name, 'Done');
		return false;
	}
);

app.intent('SafeToBurnIntent', {
		"slots":{"STATION":"LIST_OF_STATIONS"}
		,"utterances":["{Can|may|should|if} I {|Can|may|should} burn {for|in|near} {-|STATION} {|today}", 
            "Is it safe to burn {in|near} {-|STATION} {|today}"]
	},function(req,res) {
        debugLog(this.name, 'Start');
        getWeatherConditions(req.slot('STATION'), res, returnSafeToBurn);
        debugLog(this.name, 'Done');
		return false;
	}
);

app.intent('SafeToBurnTomorrowIntent', {
		"slots":{"STATION":"LIST_OF_STATIONS"}
		,"utterances":["{Can|may|should|if} I {|Can|may|should} burn {for|in|near} {-|STATION\} {tomorrow}", 
            "Is it safe to burn {in|near} {-|STATION} {tomorrow}"]
	},function(req,res) {
        debugLog(this.name, 'Start');
        getWeatherConditions(req.slot('STATION'), res, returnSafeToBurnTomorrow);
        debugLog(this.name, 'Done');
		return false;
	}
);

app.intent('ListStationsIntent', {
		"slots":{},
		"utterances":["What stations are available", 
            "List {|all|the} stations"]
	},function(req,res) {
        debugLog(this.name, 'Start');
        res.say('You can say Chatsworth, Dallas, Dawsonville, Sumtner, Watkinsville, Camilla, Americus, Adel, ' + 
        'Byromville, Fort Benning, Washington, Louisville, Brender NFS, Milledgeville, Newnan, Sterling, Waycross, ' + 
        'Baxley, Folkston, Fargo, Eddy Tower, McRae, Metter, Midway, Claxton, Richmond Hill, Taylor Creek, Lawson, ' +
        'or Ft. Stewart');
        debugLog(this.name, 'Done');
	}
);

app.pre = function(request, response, type) {
    debugLog(this.name, 'Start');
    var appId = request.data.session.application.applicationId;
    if (process.env.APPID && (appId != process.env.APPID)) {
        // fail ungracefully
        debugLog(this.name, `Invalid ID In: ${appId} Expected: ${process.env.APPID}`);
        response.fail("Invalid applicationId");
    }
    debugLog(this.name, 'Done');
};

module.exports = app;
