const Desklet = imports.ui.desklet;
const St = imports.gi.St;
const Mainloop = imports.mainloop;
const Clutter = imports.gi.Clutter;

// Persian month names
const PERSIAN_MONTH_NAMES = [
    "فروردین", "اردیبهشت", "خرداد",
    "تیر", "مرداد", "شهریور",
    "مهر", "آبان", "آذر",
    "دی", "بهمن", "اسفند"
];

const WEEKDAYS = ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنج‌شنبه", "جمعه"];

const EPOCH_JDN = 1948320.5;
const EPOCH_WEEKDAY_INDEX = 6; // جمعه

function isPersianLeapYear(year) {
    let epbase = year - (year >= 0 ? 474 : 473);
    let epyear = 474 + (epbase % 2820);
    return (((epyear * 682) - 110) % 2816) < 682;
}

function getPersianMonthLength(year, month) {
    if (month <= 6) return 31;
    if (month <= 11) return 30;
    return isPersianLeapYear(year) ? 30 : 29;
}

function p2j(jy, jm, jd) {
    let epbase = jy - (jy >= 0 ? 474 : 473);
    let epyear = 474 + (epbase % 2820);
    return jd
        + ((jm <= 7) ? ((jm - 1) * 31) : (186 + (jm - 7) * 30))
        + Math.floor((epyear * 682 - 110) / 2816)
        + (epyear - 1) * 365
        + Math.floor(epbase / 2820) * 1029983
        + 1948320.5;
}

class PersianCalendarDesklet extends Desklet.Desklet {
    constructor(metadata, desklet_id) {
        super(metadata, desklet_id);

        // Create main container
        this.mainBox = new St.BoxLayout({ vertical: true, style_class: 'calendar-container' });
        this.setContent(this.mainBox);

        // Set RTL direction for the main container
        this.mainBox.set_text_direction(St.TextDirection.RTL);

        // Create a box for the header (arrows + title)
        this.headerBox = new St.BoxLayout({ vertical: false });
        this.headerBox.set_text_direction(St.TextDirection.RTL);

        // Create left arrow button
        this.leftArrow = new St.Button({
            style_class: 'calendar-arrow',
            label: "«",
            reactive: true,
            can_focus: true,
            track_hover: true
        });
        this.leftArrow.set_text_direction(St.TextDirection.RTL);
        this.leftArrow.connect('clicked', () => {
            this._prevMonth();
        });
        this.headerBox.add(this.leftArrow, { x_fill: false, y_fill: false, expand: false });

        this.titleLabel = new St.Label({ style_class: 'calendar-title', text: "Loading..." });
        this.titleLabel.set_text_direction(St.TextDirection.RTL);
        this.headerBox.add(this.titleLabel, { expand: true });

        // Create right arrow button
        this.rightArrow = new St.Button({
            style_class: 'calendar-arrow',
            label: "»",
            reactive: true,
            can_focus: true,
            track_hover: true
        });
        this.rightArrow.set_text_direction(St.TextDirection.RTL);
        this.rightArrow.connect('clicked', () => {
            this._nextMonth();
        });
        this.headerBox.add(this.rightArrow, { x_fill: false, y_fill: false, expand: false });

        this.mainBox.add(this.headerBox, { x_fill: true, y_fill: false, expand: false });

        this.calendarBox = new St.BoxLayout({ vertical: true });
        this.calendarBox.set_text_direction(St.TextDirection.RTL);
        this.mainBox.add(this.calendarBox);

        // Determine current Persian date
        let now = new Date();
        let options = {
            year: 'numeric', month: 'numeric', day: 'numeric', weekday: 'long',
            calendar: 'persian', numberingSystem: 'latn', timeZone: 'UTC'
        };
        let persianDateString = now.toLocaleDateString('fa-IR-u-ca-persian-nu-latn', options);
        let parts = persianDateString.split(' ');
        let dateParts = parts[1].split('/');
        this.currentYear = parseInt(dateParts[0], 10);
        this.currentMonth = parseInt(dateParts[1], 10);
        // This is only used to highlight today if the displayed month is current
        this.currentDay = parseInt(dateParts[2], 10);

        this.timeout = Mainloop.timeout_add_seconds(60, this.updateCalendar.bind(this));
        this.updateCalendar();
    }

    on_desklet_removed() {
        if (this.timeout) {
            Mainloop.source_remove(this.timeout);
            this.timeout = null;
        }
    }

    _nextMonth() {
        this.currentMonth++;
        if (this.currentMonth > 12) {
            this.currentMonth = 1;
            this.currentYear++;
        }
        this.updateCalendar();
    }

    _prevMonth() {
        this.currentMonth--;
        if (this.currentMonth < 1) {
            this.currentMonth = 12;
            this.currentYear--;
        }
        this.updateCalendar();
    }

    updateCalendar() {
        // We display the calendar based on this.currentYear/this.currentMonth
        let now = new Date();
        let options = {
            year: 'numeric', month: 'numeric', day: 'numeric', weekday: 'long',
            calendar: 'persian', numberingSystem: 'latn', timeZone: 'UTC'
        };

        // Get today's Persian date again to highlight if visible month = today's month
        let persianDateString = now.toLocaleDateString('fa-IR-u-ca-persian-nu-latn', options);
        let parts = persianDateString.split(' ');
        let dateParts = parts[1].split('/');
        let todayYear = parseInt(dateParts[0], 10);
        let todayMonth = parseInt(dateParts[1], 10);
        let todayDay = parseInt(dateParts[2], 10);

        let pYear = this.currentYear;
        let pMonth = this.currentMonth;

        let monthName = PERSIAN_MONTH_NAMES[pMonth - 1];
        let monthLength = getPersianMonthLength(pYear, pMonth);

        let firstDayJdn = p2j(pYear, pMonth, 1);
        let dayDiff = Math.floor(firstDayJdn - EPOCH_JDN);

        // Adjust by -1 to align correctly
        let firstDayWeekdayIndex = ((EPOCH_WEEKDAY_INDEX + (dayDiff - 1)) % 7 + 7) % 7;

        this.titleLabel.set_text(`${pYear} ${monthName}`);

        // Clear previous calendar rows
        this.calendarBox.destroy_all_children();

        // Header row for weekdays
        let headerRow = new St.BoxLayout({ vertical: false, style_class: 'calendar-row' });
        headerRow.set_text_direction(St.TextDirection.RTL);
        WEEKDAYS.forEach((wd) => {
            headerRow.add(this._createWeekdayHeaderCell(wd));
        });
        this.calendarBox.add(headerRow);

        // Rows for days
        let day = 1;

        // Check if current displayed month is the current month
        let highlightDay = (pYear === todayYear && pMonth === todayMonth) ? todayDay : null;

        // First row
        let firstRow = new St.BoxLayout({ vertical: false, style_class: 'calendar-row' });
        for (let i = 0; i < firstDayWeekdayIndex; i++) {
            firstRow.add(this._createEmptyCell());
        }
        while (firstRow.get_children().length < 7 && day <= monthLength) {
            firstRow.add(this._createDayCell(day, (day === highlightDay)));
            day++;
        }
        this.calendarBox.add(firstRow);

        // Subsequent rows
        while (day <= monthLength) {
            let row = new St.BoxLayout({ vertical: false, style_class: 'calendar-row' });
            for (let i = 0; i < 7; i++) {
                if (day <= monthLength) {
                    row.add(this._createDayCell(day, (day === highlightDay)));
                    day++;
                } else {
                    row.add(this._createEmptyCell());
                }
            }
            this.calendarBox.add(row);
        }

        return true; // Keep update loop running
    }

    _createWeekdayHeaderCell(wd) {
        let cellBox = new St.BoxLayout({ vertical: true, style_class: 'calendar-header-cell' });
        cellBox.set_text_direction(St.TextDirection.RTL);

        let wdLabel = new St.Label({
            text: wd,
            style_class: 'calendar-header-label'
        });
        wdLabel.set_text_direction(St.TextDirection.RTL);

        cellBox.add(wdLabel);
        return cellBox;
    }

    _createDayCell(dayNumber, isToday) {
        let cellBox = new St.BoxLayout({ vertical: true, style_class: 'calendar-cell' });
        cellBox.set_text_direction(St.TextDirection.RTL);
        if (isToday) {
            cellBox.add_style_class_name('calendar-cell-today');
        }

        let label = new St.Label({
            text: dayNumber.toString(),
            style_class: 'calendar-day-label'
        });
        label.set_text_direction(St.TextDirection.RTL);

        cellBox.add(label);
        return cellBox;
    }

    _createEmptyCell() {
        let cellBox = new St.BoxLayout({ vertical: true, style_class: 'calendar-cell calendar-cell-empty' });
        cellBox.set_text_direction(St.TextDirection.RTL);
        let label = new St.Label({ text: '', style_class: 'calendar-day-label' });
        label.set_text_direction(St.TextDirection.RTL);

        cellBox.add(label);
        return cellBox;
    }
}

function main(metadata, desklet_id) {
    return new PersianCalendarDesklet(metadata, desklet_id);
}
