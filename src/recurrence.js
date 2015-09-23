'use strict';

var validator = require('validator');
var constants = require('./constants');
var moment = require('moment');

function Recurrence() {

}

Recurrence.prototype = {
    _makeError: function (err) {
        return {
            Success: false,
            ErrorMessage: err
        };
    },

    _makeRangeError: function (field, from, to) {
        return this._makeError('Invalid "' + field + '" value - it must be an integer in the range from ' + from +
            ' to ' + to);
    },

    _makeRange: function (min, max) {
        return {
            min: min,
            max: max
        };
    },

    _next: {
        Once: function (opts) {
            // When once, use just the start date. In case the start date is in the past, we return now();
            return opts.startDate;
        },

        Minutes: function (opts) {
            return opts.startDate.add({
                minutes: opts.interval
            });
        },

        Hours: function (opts) {
            return opts.startDate.add({
                hours: opts.interval
            });
        },

        Days: function (opts) {
            return opts.startDate.add({
                days: opts.interval
            });
        },

        Weeks: function (opts) {
            return opts.startDate.add({
                weeks: opts.interval
            });
        },

        Months: function (opts) {
            return opts.startDate.add({
                months: opts.interval
            });
        }
    },

    /**
     * Validates a Recurrence object - checks all dependencies
     * @param rec
     * @returns {*}
     */
    validate: function (rec) {
        if (!rec) {
            return this._makeError('Recurrence is required.');
        }

        // Validate the Type
        var type = rec.Type;
        if (!validator.isInt(type, this._makeRange(0, 6))) {
            return this._makeError('Invalid recurrence type.');
        }

        // Validate the interval
        var interval = rec.Interval;
        var isIntervalNull = rec.Interval === undefined || rec.Interval === null;

        if (isIntervalNull) {
            if (type !== constants.Type.Once) {
                // if it's null, this is allowed only for ONCE occurrences, otherwise must provide an interval.
                return this._makeError('Interval is required for this type.');
            }
        } else {
            if (!validator.isInt(interval, this._makeRange(1, 10000))) {
                return this._makeRangeError('Interval', 1, 10000);
            }
        }

        // Validate the day
        var day = rec.Day;
        if (rec.Type === constants.Type.Weeks) {
            if (!validator.isInt(day, this._makeRange(0, 6))) {
                return this._makeRangeError('Day', 0, 6);
            }
        }

        if (rec.Type === constants.Type.Months) {
            if (!validator.isInt(day, this._makeRange(1, 31))) {
                return this._makeRangeError('Day', 1, 31);
            }
        }

        return {
            Success: true
        };
    },

    getFirstOccurrence: function (rec, startDate) {
        startDate = moment(startDate);

        /**
         * Iterate until the Day matches the isMatch predicate
         * @param isMatch
         */
        var findNextDate = function (isMatch) {
            var iterationsCount = 0;
            var iterationsThreshold = 5000; // if we don't find anything in 5000 iterations, we won't find.

            while (!isMatch(startDate, rec.Day)) {
                startDate = startDate.add({
                    days: 1
                });

                iterationsCount++;
                if (iterationsCount > iterationsThreshold) {
                    throw new Error('Cannot calculate next time for: ' + JSON.stringify(rec) + ' with start date ' +
                        startDate);
                }
            }

            return startDate.seconds(0).toDate();
        };

        switch (rec.Type) {
            case constants.Type.Weeks:
                return findNextDate(function (startDate, day) {
                    return startDate.day() === day;
                });

            case constants.Type.Months:
                return findNextDate(function (startDate, day) {
                    return startDate.date() === day;
                });

            default:
                return startDate.seconds(0).toDate();
        }
    },

    next: function (rec, _startDate) {
        var validationResult = this.validate(rec);
        if (!validationResult.Success) {
            throw new Error('Cannot calculate next on an invalid recurrence. ' + validationResult.ErrorMessage);
        }

        var now = moment();
        var startDate = moment(_startDate);

        // the start date has passed so we must schedule from the current time
        if (now.isAfter(startDate)) {
            startDate = now;
        }

        var options = {
            type: rec.Type,
            interval: rec.Interval,
            day: rec.Day,
            startDate: startDate
        };

        var typeName = constants.TypeString[options.type];

        // happy debugging.
        var nextDate = this._next[typeName](options)
            .seconds(0);

        if (options.type === constants.Type.Days ||
            options.type === constants.Type.Weeks ||
            options.type === constants.Type.Months) {
            nextDate = nextDate.minutes(_startDate.getMinutes())
                .hours(_startDate.getHours());

            // TODO: For near future add some check if somehow the Day have not moved...
        }

        return nextDate.toDate();
    },

    describe: function (job) {
        var describedJob = [];

        var dateFormat = 'D/M/YYYY';
        var hoursFormat = 'h:mm';
        var notSet = 'Not set';

        var startDate = moment(job.StartDate);
        var endDate = moment(job.EndValue);

        function tryInsertComma(shouldInsert) {
            return shouldInsert ? ',' : '';
        }

        function getStartTimestamp(commaAfterToday, commaAfterHours, commaAfterDayString) {
            var startTimestamp = [];

            if (!job.StartDate) {
                startTimestamp.push(notSet);
                return startTimestamp;
            }

            if (startDate.isSame(moment(), 'day')) {
                startTimestamp.push('Today' + tryInsertComma(commaAfterToday));
                var todayHours = startDate.format(hoursFormat);
                startTimestamp.push(todayHours + tryInsertComma(commaAfterHours && job.EndType !== constants.EndType.Unlimited));
            } else {
                var formattedExecutionDate = startDate.format(dateFormat);
                startTimestamp.push(formattedExecutionDate);
            }

            if (job.Recurrence.Type === constants.Type.Weeks ||
                job.Recurrence.Type === constants.Type.Months) {
                startTimestamp.push('on');

                var dayString = dayToString(job.Recurrence.Day, job.Recurrence.Type);
                startTimestamp.push(dayString + tryInsertComma(commaAfterDayString));
            } else {
                if (commaAfterDayString) {
                    //we should insert a comma after all
                    startTimestamp[startTimestamp.length - 1] = startTimestamp[startTimestamp.length - 1] + ',';
                }
            }

            return startTimestamp;
        }

        function getEndTimestamp() {
            var endTimestamp = [];

            if (job.EndType === constants.EndType.Unlimited) {
                return endTimestamp;
            } else {
                endTimestamp.push('until');
            }

            if (!job.EndValue) {
                endTimestamp.push(notSet);
                return endTimestamp;
            }

            if (job.EndType === constants.EndType.EndDate) {
                var formattedEndDate = endDate.format(dateFormat);
                endTimestamp.push(formattedEndDate);
            } else if (job.EndType === constants.EndType.NumberOfOccurences) {
                endTimestamp.push('after ' + job.EndValue + ' occurrences');
            }

            return endTimestamp;
        }

        function dayToString(day, type) {
            if (!day) {
                return notSet;
            }

            var localeData = moment().localeData();

            if (type === constants.Type.Months) {
                return localeData.ordinal(day);
            }

            //week
            return localeData.weekdaysShort({
                day: function () {
                    return day; //well this is the best I found in the docs.
                }
            })
        }

        if (job.Recurrence.Type === constants.Type.Once) {
            describedJob.push('Single execution scheduled for');
            var startTimestampOnce = getStartTimestamp();
            describedJob = describedJob.concat(startTimestampOnce);
        } else {
            describedJob.push('Every');
            describedJob.push(job.Recurrence.Interval || notSet);
            describedJob.push(constants.TypeString[job.Recurrence.Type].toLowerCase());
            describedJob.push('from');
            var endTimestamp = getEndTimestamp();
            var commaAfterDay = !!endTimestamp.length;
            var commaAfterToday = !commaAfterDay;
            var commaAfterHours = !commaAfterDay;

            var startTimestamp = getStartTimestamp(commaAfterToday, commaAfterHours, commaAfterDay);

            describedJob = describedJob.concat(startTimestamp).concat(endTimestamp);
        }

        return describedJob.join(' ');
    },

    Constants: constants
};

module.exports = new Recurrence();
