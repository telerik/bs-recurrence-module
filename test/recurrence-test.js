if (typeof window === 'undefined') {
    var should = require('should');
    var moment = require('moment');
    var recurrence = require('../dist/recurrence.js');
}

var getNow = function getNow() {
    return moment({
        year: 2015,
        month: 8,
        day: 23,
        hour: 10,
        minute: 30
    });
};

var getDate = function getDate(year, month, day, hour, minute) {
    var d = moment({
        year: year,
        month: month,
        day: day,
        hour: hour,
        minute: minute
    });

    return d.toDate();
};

var returnDate = function returnDate(date) {
    return function() {
        return date;
    }
};

// Now is Sep 23 2015, 10:30 AM UTC
recurrence._now = getNow;

var compareFirst = function(rec, fromDate, fromTime, expected) {
    var actual = moment( recurrence.next(rec, fromDate, fromTime, true)).startOf('minute').toDate();
    actual.should.deepEqual(expected);
};

var compareNext = function(rec, fromDate, fromTime, expected) {
    var actual = moment( recurrence.next(rec, fromDate, fromTime, false)).startOf('minute').toDate();
    actual.should.deepEqual(expected);
};

var getStartTime = function(hours, minutes) {
    return hours * 60 + minutes;
};

suite('recurrence - happy path', function () {
    // runs before every test and clears the get_now
    setup(function() {
        recurrence._now = getNow;
    });

    suite('Every 3 hours starts at 18:25', function () {
        var rec = {
            Type: 2, // Hours
            Interval: 3
        };
        var startDate = getNow().startOf('day').toDate();
        var startTime = getStartTime(18, 25);

        var d1 = getDate(2015, 8, 23, 18, 25);
        test('First occurrence should be at Sep 23 2015, 18:25 PM', function () {
            compareFirst(rec, startDate, startTime, d1);
        });


        var d2 = getDate(2015, 8, 23, 21, 25);
        test('Next occurrence should be at occurrence should be at Sep 23 2015, 21:25 PM', function () {
            recurrence._now = returnDate(d1);
            compareNext(rec, d1, startTime, d2);
        });

        var d3 = getDate(2015, 8, 24, 0, 25);
        test('Next occurrence should be at occurrence should be at Sep 24 2015, 00:25 AM', function () {
            recurrence._now = returnDate(d2);
            compareNext(rec, d2, startTime, d3);
        });

        var d4 = getDate(2015, 8, 24, 3, 25);
        test('Next occurrence should be at occurrence should be at Sep 24 2015, 03:25 AM', function () {
            recurrence._now = returnDate(d3);
            compareNext(rec, d3, startTime, d4);
        });
    });

    suite('Every 45 minutes starts at 10:41', function () {
        var rec = {
            Type: 1, // minutes
            Interval: 45
        };
        var startDate = getNow().startOf('minutes').toDate();
        var startTime = getStartTime(10, 41);

        var d1 = getDate(2015, 8, 23, 10, 41);
        test('First occurrence should be at Sep 23 2015, 10:41 PM', function () {
            compareFirst(rec, startDate, startTime, d1);
        });


        var d2 = getDate(2015, 8, 23, 11, 26);
        test('Next occurrence should be at occurrence should be at Sep 23 2015, 11:26 PM', function () {
            recurrence._now = returnDate(d1);
            compareNext(rec, d1, startTime, d2);
        });

        var d3 = getDate(2015, 8, 23, 12, 11);
        test('Next occurrence should be at occurrence should be at Sep 23 2015, 12:11 PM', function () {
            recurrence._now = returnDate(d2);
            compareNext(rec, d2, startTime, d3);
        });
    });

    suite('Every 40 days starts at 15:00', function () {
        var rec = {
            Type: 3, //days
            Interval: 40
        };

        var startDate = getNow().startOf('minutes').toDate();
        var startTime = getStartTime(15, 0);

        var d1 = getDate(2015, 8, 23, 15, 0);
        test('First occurrence should be at Sep 23 2015, 15:00 PM', function () {
            compareFirst(rec, startDate, startTime, d1);
        });

        var d2 = getDate(2015, 10, 2, 15, 0);
        test('Next occurrence should be at occurrence should be at Nov 02 2015, 15:00 PM', function () {
            recurrence._now = returnDate(d1);
            compareNext(rec, d1, startTime, d2);
        });

        var d3 = getDate(2015, 11, 12, 15, 0);
        test('Next occurrence should be at occurrence should be at Dec 12 2015, 15:00 PM', function () {
            recurrence._now = returnDate(d2);
            compareNext(rec, d2, startTime, d3);
        });

        var d4 = getDate(2016, 0, 21, 15, 0);
        test('Next occurrence should be at occurrence should be at Jan 21 2016, 15:00 PM', function () {
            recurrence._now = returnDate(d3);
            compareNext(rec, d3, startTime, d4);
        });
    });

    suite('Every 7 months starts at the 7th', function () {
        var rec = {
            Type: 5, // months
            Interval: 7,
            Day: 7
        };
        var startDate = getNow().startOf('minutes').toDate();
        var startTime = getStartTime(15, 3);

        var d1 = getDate(2015, 9, 7, 15, 3);
        test('First occurrence should be at Oct 7 2015, 15:03 PM', function () {
            compareFirst(rec, startDate, startTime, d1);
        });

        var d2 = getDate(2016, 4, 7, 15, 3);
        test('Next occurrence should be at occurrence should be at May 7 2016, 15:03 PM', function () {
            recurrence._now = returnDate(d1);
            compareNext(rec, d1, startTime, d2);
        });

        var d3 = getDate(2016, 11, 7, 15, 3);
        test('Next occurrence should be at occurrence should be at Dec 7 2016, 15:03 PM', function () {
            recurrence._now = returnDate(d2);
            compareNext(rec, d2, startTime, d3);
        });

        var d4 = getDate(2017, 6, 7, 15, 3);
        test('Next occurrence should be at occurrence should be at Jul 7 2017, 15:03 PM', function () {
            recurrence._now = returnDate(d3);
            compareNext(rec, d3, startTime, d4);
        });
    });

    suite('Every 6 weeks starts at the Wednesday', function () {
        var rec = {
            Type: 4, // weeks
            Interval: 6,
            Day: 3
        };
        var startDate = getNow().startOf('minutes').toDate();
        var startTime = getStartTime(15, 3);

        var d1 = getDate(2015, 8, 23, 15, 3);
        test('First occurrence should be at Sep 23 2015, 15:03 PM (Today)', function () {
            compareFirst(rec, startDate, startTime, d1);
        });

        test('First occurrence should be at Sep 23 2015, 15:03 PM (Tomorrow)', function () {
            // now it's Sep 22 2015, 10:00 PM
            recurrence._now = returnDate( moment( getDate(2015, 8, 22, 10, 0) ) );

            compareFirst(rec, startDate, startTime, d1);
        });

        var d11 = getDate(2015, 8, 30, 15, 3);
        test('First occurrence should be at Sep 30 2015, 15:03 PM (Next week)', function () {
            var retDate = moment(getNow()).add({ hours: 7 });
            recurrence._now = returnDate( retDate );

            compareFirst(rec, startDate, startTime, d11);
        });

        var d2 = getDate(2015, 10, 4, 15, 3);
        test('Next occurrence should be at occurrence should be at Nov 04 2015, 15:03 PM', function () {
            recurrence._now = returnDate(d1);
            compareNext(rec, d1, startTime, d2);
        });

        var d3 = getDate(2015, 11, 16, 15, 3);
        test('Next occurrence should be at occurrence should be at Dec 16 2015, 15:03 PM', function () {
            recurrence._now = returnDate(d2);
            compareNext(rec, d2, startTime, d3);
        });
    });

    suite('Once with passed date and time - must execute immediately', function () {
        var rec = {
            Type: 0 // once
        };

        var startDate = getNow();
        var startTime = getStartTime(0, 0);

        var d1 = getDate(2015, 8, 23, 0, 0);
        test('First occurrence should be at Sep 23 2015, 00:00 PM (Today)', function () {
            compareFirst(rec, startDate, startTime, d1);
        });

        // TODO: test('Once: now is before the execution start time.')
    });

    suite('Improvements', function() {
        var rec = {
            Type: recurrence.Constants.Type.Once,
            Day: 1
        };

        test('Once, Date.Now + 2 mins, First Occurrence check', function() {
            var startDate = getNow();
            var startTime = getStartTime( startDate.hour(), startDate.minutes() + 2);

            var date = getNow().add({minutes: 2 }).toDate();
            compareFirst(rec, startDate, startTime, date);
        });

        test('Before 3 hours, On every hour, Must schedule for 11:00', function() {
            var rec = {
                Type: recurrence.Constants.Type.Hours, // every one hour
                Interval: 1
            };

            var before3Hours = getNow().add({hours: -3, minutes: 30 });
            var startTime = getStartTime(7, 0);
            var d1 = getDate(2015, 8, 23, 11, 0);

            compareNext(rec, before3Hours, startTime, d1);
        });
    });
});

suite('describe', function () {
    var testDescribe = function (job, exp) {
        var res = recurrence.describe(job);
        res.should.be.exactly(exp);
    };

    test('Every 5 minutes from Today 8:20, until 8/9/2015', function () {
    testDescribe({
        Recurrence: {
            Type: recurrence.Constants.Type.Minutes,
            Interval: 5
        },
        EndType: recurrence.Constants.EndType.EndDate,
        EndValue: moment('8/9/2015', 'D/M/YYYY').toDate(),
        StartDate: moment().hours(8).minutes(20).toDate()
    }, this.test.title);
});

test('Single execution scheduled for Today 9:29', function () {
    testDescribe({
        Recurrence: {
            Type: recurrence.Constants.Type.Once
        },
        StartDate: moment().hours(9).minutes(29).toDate()
    }, this.test.title);
});

test('Every 16 weeks from 10/12/2016 on Wed, until 15/12/2017', function () {
    testDescribe({
        Recurrence: {
            Type: recurrence.Constants.Type.Weeks,
            Interval: 16,
            Day: 3
        },
        EndType: recurrence.Constants.EndType.EndDate,
        EndValue: moment('15/12/2017', 'D/M/YYYY').toDate(),
        StartDate: moment('10/12/2016', 'D/M/YYYY').toDate()
    }, this.test.title);
});

test('Every 6 months from 5/11/2015 on 1st, until 6/11/2015', function () {
    testDescribe({
        Recurrence: {
            Type: recurrence.Constants.Type.Months,
            Interval: 6,
            Day: 1
        },
        EndType: recurrence.Constants.EndType.EndDate,
        EndValue: moment('6/11/2015', 'D/M/YYYY').toDate(),
        StartDate: moment('5/11/2015', 'D/M/YYYY').toDate()
    }, this.test.title);
});

test('Every 6 months from 5/11/2015 on 2nd, until Not set', function () {
    testDescribe({
        Recurrence: {
            Type: recurrence.Constants.Type.Months,
            Interval: 6,
            Day: 2
        },
        StartDate: moment('5/11/2015', 'D/M/YYYY').toDate()
    }, this.test.title);
});

test('Every 6 months from Not set until 6/11/2015', function () {
    testDescribe({
        Recurrence: {
            Type: recurrence.Constants.Type.Months,
            Interval: 6
        },
        EndType: recurrence.Constants.EndType.EndDate,
        EndValue: moment('6/11/2015', 'D/M/YYYY').toDate()
    }, this.test.title)
});

test('Every 6 months from 5/11/2015 on Not set, until Not set', function () {
    testDescribe({
        Recurrence: {
            Type: recurrence.Constants.Type.Months,
            Interval: 6
        },
        StartDate: moment('5/11/2015', 'D/M/YYYY').toDate()
    }, this.test.title);
});

test('Every 6 months from 5/11/2015 on Not set, until after 5 occurrences', function () {
    testDescribe({
        Recurrence: {
            Type: recurrence.Constants.Type.Months,
            Interval: 6
        },
        StartDate: moment('5/11/2015', 'D/M/YYYY').toDate(),
        EndType: recurrence.Constants.EndType.NumberOfOccurences,
        EndValue: 5
    }, this.test.title);
});

test('Every 6 months from 5/11/2015 on Not set, until after 5 occurrences', function () {
    testDescribe({
        Recurrence: {
            Type: recurrence.Constants.Type.Months,
            Interval: 6
        },
        StartDate: moment('5/11/2015', 'D/M/YYYY').toDate(),
        EndType: recurrence.Constants.EndType.NumberOfOccurences,
        EndValue: 5
    }, this.test.title);
});

test('Every 6 months from 5/11/2015 on 28th', function () {
    testDescribe({
        Recurrence: {
            Type: recurrence.Constants.Type.Months,
            Interval: 6,
            Day: 28
        },
        StartDate: moment('5/11/2015', 'D/M/YYYY').toDate(),
        EndType: recurrence.Constants.EndType.Unlimited
    }, this.test.title);
});

test('Every 3 months from Today 9:29 on 3rd, until after 1 occurrences', function () {
    testDescribe({
        Recurrence: {
            Type: recurrence.Constants.Type.Months,
            Interval: 3,
            Day: 3
        },
        EndType: recurrence.Constants.EndType.NumberOfOccurences,
        EndValue: 1,
        StartDate: moment().hours(9).minutes(29).toDate()
    }, this.test.title);
});

test('Every day from Today, 9:29', function () {
    testDescribe({
        Recurrence: {
            Type: recurrence.Constants.Type.Days,
            Interval: 1
        },
        EndType: recurrence.Constants.EndType.Unlimited,
        StartDate: moment().hours(9).minutes(29).toDate()
    }, this.test.title);
});
});