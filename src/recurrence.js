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

    _now: function () {
        return moment().startOf('minute');
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
            if (!validator.isInt(interval, this._makeRange(1, 1000))) {
                return this._makeRangeError('Interval', 1, 1000);
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

    getMomentUnit: function (type) {
        var units = {
            1: 'm',
            2: 'h',
            3: 'd',
            4: 'w',
            5: 'M'
        };
        return units[+type];
    },

    isMonth: function(type) {
        return this.getMomentUnit(type) === 'M';
    },

    _getFirstOccurrence: function (rec, fromDate, fromTimeInMinutes) {
        var originalFromDate = fromDate;

        // Convert date to Moment and clear-out the HH:MM:SS
        fromDate = moment(fromDate).startOf('day');

        // Add the minutes from the beginning
        fromDate = fromDate.add({minutes: fromTimeInMinutes});

        // Current time
        var now = this._now();

        /**
         * Iterate until the Day matches the isMatch predicate
         * @param isMatch
         */
        var findNextDate = function (isMatch, iterateFn) {
            iterateFn = iterateFn || function addOneDay(d) {
                    return d.add({
                        days: 1
                    });
                };

            var iterationsCount = 0;
            var iterationsThreshold = 5000; // if we don't find anything in 5000 iterations, we won't find.

            while (!isMatch(fromDate, rec.Day)) {
                fromDate = iterateFn(fromDate);

                iterationsCount++;
                if (iterationsCount > iterationsThreshold) {
                    throw new Error('Cannot calculate next time for: ' + JSON.stringify(rec) + ' with start date ' +
                        fromDate);
                }
            }

            return fromDate.startOf('minute').toDate();
        };

        switch (rec.Type) {
            case constants.Type.Weeks:
                return findNextDate(function isDayEqual(from, day) {
                    return from.day() === day && (now.isBefore(from) || now.isSame(from));
                });

            case constants.Type.Months:
                return findNextDate(function isDateEqual(from, day) {
                    return from.date() === day && (now.isBefore(from) || now.isSame(from));
                });

            case constants.Type.Once:
                // The From Date is in the future - so return it as it is.
                if(fromDate.isAfter(now)) {
                    return fromDate.startOf('minute').toDate();
                }

                throw new Error('Cannot schedule a once execution in the past.');

            default:
                // The From Date is in the future - so return it as it is.
                if(fromDate.isAfter(now)) {
                    return fromDate.startOf('minute').toDate();
                }

                // Iterate to find the next appropriate time for execution
                var nextDate = this.findNextScheduledTime(rec, originalFromDate, fromDate.startOf('minute'));
                return nextDate.toDate();
        }
    },

    //normalizes the recurrence to a valid state
    //modifies the passed object
    _transformRecurrence: function (rec) {
        rec.Type = +rec.Type;
        if (rec.Interval) {
            rec.Interval = +rec.Interval;
        }

        if (rec.Day) {
            rec.Day = +rec.Day;
        }
    },

    findNextScheduledTime: function findNextScheduledTime(rec, originalFromDate, from) {
        var momentUnit = this.getMomentUnit(rec.Type);

        if (!momentUnit) {
            throw new Error('Invalid recurrence type. Type = ' + rec.Type);
        }

        var now = this._now();
        var iterationsCount = 0;
        var iterationsThreshold = 100000000; //(69444 days / 190 years) in case for every 1 minute

        // If From date is before current time
        // or if from is the same as now, and we haven't iterated - we must get the next execution time
        while (from.isBefore(now) || (from.isSame(now) && iterationsCount === 0)) {
            from = from.add(momentUnit, rec.Interval);

            iterationsCount++;
            if (iterationsCount > iterationsThreshold) {
                throw new Error('Cannot calculate next time for: ' + JSON.stringify(rec) + ' with from date ' +
                    originalFromDate);
            }
        }

        // In case of month, ensure it's the correct day of the month.
        if (this.isMonth(rec.Type)) {
            // if it's a month and its some of the latest day in the month, check to see if this is the appropriate day.
            while (from.date() < rec.Day) {
                var nxtDate = moment(from);
                nxtDate.add({days: 1});
                if (nxtDate.month() !== from.month()) {
                    // the current month doesn't have a Day with value rec.Day, so we'll be using
                    // the latest one of the month which is in from now.
                    break;
                }

                // It's in the same month, therefore it's safe to move to this date
                // it's guaranteed that the
                from = nxtDate;
            }
        }

        return from;
    },

    next: function (rec, fromDate, fromTimeInMinutes, isFirst) {
        this._transformRecurrence(rec);

        var validationResult = this.validate(rec);
        if (!validationResult.Success) {
            throw new Error('Cannot calculate next on an invalid recurrence. ' + validationResult.ErrorMessage);
        }

        if (isFirst) {
            return this._getFirstOccurrence(rec, fromDate, fromTimeInMinutes);
        }

        var now = this._now();
        var fromMoment = moment(fromDate);

        if (rec.Type === constants.Type.Once) {
            if (fromMoment.isBefore(now)) {
                return now.toDate();
            }

            return fromMoment.toDate();
        }

        var nextDate = this.findNextScheduledTime(rec, fromDate, fromMoment);
        return nextDate.toDate();
    },

    describe: function (job) {
        this._transformRecurrence(job.Recurrence);

        var describedJob = [];

        var dateFormat = 'MMM DD, YYYY';
        var hoursFormat = 'h:mm A';
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

            var todayHours = startDate.format(hoursFormat);
            if (startDate.isSame(moment(), 'day')) {
                startTimestamp.push('Today' + tryInsertComma(commaAfterToday));
                startTimestamp.push(todayHours + tryInsertComma(commaAfterHours && job.EndType !== constants.EndType.Unlimited));
            } else {
                var formattedExecutionDate = startDate.format(dateFormat + ' ' + hoursFormat);
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

            var type = (constants.TypeString[job.Recurrence.Type] || '').toLowerCase();
            if (!type) {
                throw new Error('Invalid recurrence type. ' + job.Recurrence.Type);
            }

            if (job.Recurrence.Interval === 1) {
                if (type !== constants.TypeString[constants.Type.Once]) {
                    //every day, month etc.
                    var singularType = type.substring(0, type.length - 1);
                    describedJob.push(singularType);
                } else {
                    //once
                    describedJob.push(type);
                }
            } else {
                describedJob.push(job.Recurrence.Interval || notSet);
                describedJob.push(type);
            }

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
