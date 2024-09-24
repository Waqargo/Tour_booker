const daysTag = document.querySelector(".days"),
    currentDate = document.querySelector(".current-date"),
    prevNextIcon = document.querySelectorAll(".icons span");

// Getting new date, current year, and month
let date = new Date(),
    currYear = date.getFullYear(),
    currMonth = date.getMonth();

const months = ["January", "February", "March", "April", "May", "June", "July",
    "August", "September", "October", "November", "December"];

// Function to fetch booked days from the backend
const fetchBookings = async (year, month) => {
    try {
        const response = await fetch(`/api/bookings/${year}/${month}`);
        const data = await response.json();
        return data.bookedDays || []; // Ensure this returns the booked days array
    } catch (error) {
        console.error('Error fetching bookings:', error);
        return [];
    }
};

const renderCalendar = async () => {
    let firstDayofMonth = new Date(currYear, currMonth, 1).getDay(), // Getting first day of month
        lastDateofMonth = new Date(currYear, currMonth + 1, 0).getDate(), // Getting last date of month
        lastDayofMonth = new Date(currYear, currMonth, lastDateofMonth).getDay(), // Getting last day of month
        lastDateofLastMonth = new Date(currYear, currMonth, 0).getDate(); // Getting last date of previous month

    let liTag = "";

    // Fetch bookings for the current year and month
    const bookings = await fetchBookings(currYear, currMonth);

    // Previous month's last days
    for (let i = firstDayofMonth; i > 0; i--) {
        liTag += `<li class="inactive">${lastDateofLastMonth - i + 1}</li>`;
    }

    // Current month's days
    for (let i = 1; i <= lastDateofMonth; i++) {
        let isToday = i === date.getDate() && currMonth === new Date().getMonth() && currYear === new Date().getFullYear() ? "active" : "";
        let isBooked = bookings.includes(i) && (currYear > date.getFullYear() || currMonth > date.getMonth() || i >= date.getDate()) ? "booked" : ""; // Check if the day is booked and is today or in the future
        liTag += `<li class="${isToday} ${isBooked}">${i}</li>`;
    }

    // Next month's first days
    for (let i = lastDayofMonth; i < 6; i++) {
        liTag += `<li class="inactive">${i - lastDayofMonth + 1}</li>`;
    }

    currentDate.innerText = `${months[currMonth]} ${currYear}`; // Passing current month and year
    daysTag.innerHTML = liTag;
};
renderCalendar();

prevNextIcon.forEach(icon => { // Getting prev and next icons
    icon.addEventListener("click", () => {
        currMonth = icon.id === "prev" ? currMonth - 1 : currMonth + 1;

        if (currMonth < 0 || currMonth > 11) { // If current month is less than 0 or greater than 11
            date = new Date(currYear, currMonth, new Date().getDate());
            currYear = date.getFullYear(); // Updating current year
            currMonth = date.getMonth(); // Updating current month
        } else {
            date = new Date(); // Pass the current date
        }
        renderCalendar();
    });
});
