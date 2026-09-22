// =====================================
// Student Registration
// =====================================

const studentForm = document.getElementById("studentForm");


if (studentForm) {

    studentForm.addEventListener("submit", function(event) {

        event.preventDefault();


        const name =
            document.getElementById("studentName").value;

        const email =
            document.getElementById("studentEmail").value;

        const phone =
            document.getElementById("studentPhone").value;

        const password =
            document.getElementById("studentPassword").value;

        const confirmPassword =
            document.getElementById("studentConfirmPassword").value;

        const university =
            document.getElementById("studentUniversity").value;

        const homeArea =
            document.getElementById("studentHomeArea").value;


        // Check passwords

        if (password !== confirmPassword) {

            alert("Passwords do not match.");

            return;
        }


        // Create student object

        const student = {

            id: Date.now(),

            fullName: name,

            email: email,

            phone: phone,

            password: password,

            university: university,

            homeArea: homeArea,

            role: "student",

            status: "active"

        };


        // Save user temporarily

        localStorage.setItem(
            "darbgoUser",
            JSON.stringify(student)
        );


        alert(
            "Account Created Successfully!"
        );


        // Go to Login

        window.location.href = "login.html";

    });

}
// =====================================
// Driver Registration
// =====================================

const driverForm = document.getElementById("driverForm");


if (driverForm) {

    driverForm.addEventListener("submit", function(event) {

        event.preventDefault();


        // Personal Information

        const name =
            document.getElementById("driverName").value;

        const email =
            document.getElementById("driverEmail").value;

        const phone =
            document.getElementById("driverPhone").value;

        const password =
            document.getElementById("driverPassword").value;

        const confirmPassword =
            document.getElementById("driverConfirmPassword").value;


        // Vehicle Information

        const vehicleType =
            document.getElementById("vehicleType").value;

        const vehicleModel =
            document.getElementById("vehicleModel").value;

        const plateNumber =
            document.getElementById("plateNumber").value;

        const numberOfSeats =
            document.getElementById("numberOfSeats").value;


        // Files

        const vehiclePhoto =
            document.getElementById("vehiclePhoto").files[0];

        const drivingLicense =
            document.getElementById("drivingLicense").files[0];

        const idDocument =
            document.getElementById("idDocument").files[0];


        // Check Password

        if (password !== confirmPassword) {

            alert("Passwords do not match.");

            return;
        }


        // Create Driver

        const driver = {

            id: Date.now(),

            fullName: name,

            email: email,

            phone: phone,

            password: password,


            vehicle: {

                type: vehicleType,

                model: vehicleModel,

                plateNumber: plateNumber,

                seats: numberOfSeats,

                photo:
                    vehiclePhoto
                    ? vehiclePhoto.name
                    : ""

            },


            verification: {

                drivingLicense:
                    drivingLicense
                    ? drivingLicense.name
                    : "",

                idDocument:
                    idDocument
                    ? idDocument.name
                    : ""

            },


            role: "driver",

            status: "pending"

        };


        // Save Driver

        localStorage.setItem(
            "darbgoUser",
            JSON.stringify(driver)
        );


        alert(
            "Account Created — Pending Review"
        );


        // Go to Login

        window.location.href = "login.html";

    });

}
// =====================================
// Login
// =====================================

const loginForm = document.getElementById("loginForm");


if (loginForm) {

    loginForm.addEventListener("submit", function(event) {

        event.preventDefault();


        const identifier =
            document.getElementById("loginIdentifier").value
            .trim();

        const password =
            document.getElementById("loginPassword").value;


        // Get saved user

        const savedUser =
            localStorage.getItem("darbgoUser");


        if (!savedUser) {

            alert(
                "No account found. Please create an account first."
            );

            return;
        }


        const user =
            JSON.parse(savedUser);


        // Check Email or Phone

        const identifierMatch =
            user.email === identifier ||
            user.phone === identifier;


        if (!identifierMatch) {

            alert(
                "Email/Phone or Password is incorrect."
            );

            return;
        }


        // Check Password

        if (user.password !== password) {

            alert(
                "Email/Phone or Password is incorrect."
            );

            return;
        }


        // Check Account Status

        if (user.status === "pending") {

            alert(
                "Your driver account is still under review."
            );

            return;
        }


        if (user.status === "rejected") {

            alert(
                "Your account has been rejected."
            );

            return;
        }


        // Save logged-in user

        sessionStorage.setItem(
            "loggedInUser",
            JSON.stringify(user)
        );


        // Check Role

        if (user.role === "student") {

            window.location.href =
                "student-dashboard.html";

        }

        else if (user.role === "driver") {

            window.location.href =
                "driver-dashboard.html";

        }

        else if (user.role === "admin") {

            window.location.href =
                "admin-dashboard.html";

        }

    });

}
// =====================================
// Logout
// =====================================

function logout() {

    sessionStorage.removeItem("loggedInUser");

    window.location.href = "login.html";
}