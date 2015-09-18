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
        var result = [];

        var dateFormat = 'D/M/YYYY';
        var startDate = moment(job.StartDate);
        var endDate = moment(job.EndDate);

        function insertTimestamp(commaAfterToday, commaAfterHours) {
            if (startDate.isSame(moment(), 'day')) {
                result.push('Today' + (commaAfterToday ? ',' : ''));
                var todayHours = startDate.format('h:mm');
                result.push(todayHours + (commaAfterHours ? ',' : ''));
            } else {
                var formattedExecutionDate = startDate.format(dateFormat);
                result.push(formattedExecutionDate);
            }
        }

        if (job.Recurrence.Type === constants.Type.Once) {
            result.push('Single execution scheduled for');
            insertTimestamp();
        } else {
            result.push('Every');
            result.push(job.Recurrence.Interval);
            result.push(constants.TypeString[job.Recurrence.Type].toLowerCase());
            result.push('from');
            insertTimestamp(true, true);
            result.push('until');

            var formattedEndDate = endDate.format(dateFormat);
            result.push(formattedEndDate);
        }

        return result.join(' ');
    },

    Constants: constants
};

module.exports = new Recurrence();
