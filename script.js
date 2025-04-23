const form = document.getElementById('vaForm');
const responseMessage = document.getElementById('responseMessage');
const submitButton = document.getElementById('submitButton');
const buttonText = submitButton.querySelector('.button-text');
const spinner = submitButton.querySelector('.spinner');

// V V V V V V V V V V V V V V V V V V V V V V V V V V V V V V V V V V V
// !!! ENSURE THIS IS YOUR CORRECT, DEPLOYED WEB APP URL !!!
const scriptURL = 'https://script.google.com/macros/s/AKfycbyUI4fjvjpYBR_amY8UMPxTt667Td4dDODCbPhifWyF0x08Li6cFC8udl4FFQzxHY0GFg/exec';
// ^ ^ ^ ^ ^ ^ ^ ^ ^ ^ ^ ^ ^ ^ ^ ^ ^ ^ ^ ^ ^ ^ ^ ^ ^ ^ ^ ^ ^ ^ ^ ^ ^ ^ ^

// Basic Email Validation Regex
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Function to show error messages for specific fields
function showValidationError(fieldId, message) {
    const errorDiv = document.getElementById(fieldId + 'Error');
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
    }
    // Only mark actual input fields as invalid, not the recaptcha div container
    const inputField = document.getElementById(fieldId);
    if (inputField && inputField.tagName !== 'DIV') {
       inputField.setAttribute('aria-invalid', 'true');
    }
}

// Function to clear all validation errors
function clearValidationErrors() {
    const errorMessages = form.querySelectorAll('.error-message');
    errorMessages.forEach(msg => {
        msg.textContent = '';
        msg.style.display = 'none';
    });
     const invalidFields = form.querySelectorAll('[aria-invalid="true"]');
    invalidFields.forEach(field => field.removeAttribute('aria-invalid'));
}

// Client-side validation function
function validateForm() {
    clearValidationErrors();
    let isValid = true;

    // Check required fields
    const requiredFields = form.querySelectorAll('[required]');
    requiredFields.forEach(field => {
        if (!field.value.trim()) {
            isValid = false;
            // Try to get label text more reliably
            let label = form.querySelector(`label[for='${field.id}']`);
            let fieldName = label ? label.textContent.replace(':','') : 'Field';
            showValidationError(field.id, `${fieldName} is required.`);
        }
    });

    // Check email format
    const emailField = document.getElementById('email');
    if (emailField.value.trim() && !emailPattern.test(emailField.value.trim())) {
         isValid = false;
         showValidationError(emailField.id, 'Please enter a valid email address.');
    }

    // Check reCAPTCHA response
    // Ensure grecaptcha object exists before calling getResponse
    const recaptchaResponse = (typeof grecaptcha !== 'undefined') ? grecaptcha.getResponse() : '';
    if (!recaptchaResponse) {
        isValid = false;
        showValidationError('recaptcha', 'Please complete the CAPTCHA verification.');
    }

    return isValid;
}

// *** CORRECTED Configuration Check ***
// Check if URL is missing OR if it STILL contains the placeholder
if (!scriptURL || scriptURL === 'YOUR_APPS_SCRIPT_WEB_APP_URL') { // <-- Compare against placeholder
    console.error("ERROR: Apps Script URL is not set correctly in script.js!");
    responseMessage.textContent = 'Configuration error: The form cannot be submitted. Please contact the administrator.';
    responseMessage.className = 'response-message error';
    responseMessage.style.display = 'block';
    if(submitButton) submitButton.disabled = true; // Disable submit if misconfigured
}

form.addEventListener('submit', e => {
    e.preventDefault(); // Stop browser from submitting the form traditionally

    // *** CORRECTED Configuration Check within listener ***
     if (!scriptURL || scriptURL === 'YOUR_APPS_SCRIPT_WEB_APP_URL') {
         responseMessage.textContent = 'Configuration error: Form cannot be submitted.';
         responseMessage.className = 'response-message error';
         responseMessage.style.display = 'block';
         return; // Stop the submission if URL is not set
     }

    // Honeypot Check
    const honeypot = form.querySelector('[name="honeypot_field"]');
    if (honeypot && honeypot.value) {
        console.log("Honeypot field filled, likely bot submission.");
        return; // Silently stop processing
    }

    // Client-side validation (includes reCAPTCHA)
    if (!validateForm()) {
        responseMessage.textContent = 'Please correct the errors highlighted above.';
        responseMessage.className = 'response-message error';
        responseMessage.style.display = 'block';
        // Reset reCAPTCHA only if validation fails *after* it was completed
        if (typeof grecaptcha !== 'undefined' && grecaptcha.getResponse()) {
             grecaptcha.reset();
        }
        return; // Stop submission if validation fails
    }

    // Disable button and show submitting state
    submitButton.disabled = true;
    buttonText.textContent = 'Submitting...';
    spinner.style.display = 'inline-block';

    // Clear previous main response messages and hide
    responseMessage.textContent = '';
    responseMessage.className = 'response-message';
    responseMessage.style.display = 'none';

    // Use FormData (includes g-recaptcha-response if widget is in the form)
    const formData = new FormData(form);

    // Send data to Google Apps Script
    fetch(scriptURL, { method: 'POST', body: formData })
        .then(response => {
            if (!response.ok) {
                 return response.text().then(text => { // Get text for more error detail
                    throw new Error(`Network response was not ok (Status: ${response.status}). Server response: ${text}`);
                 });
            }
             return response.json(); // Expect JSON response from Apps Script
         })
        .then(data => {
            console.log('Response from Apps Script:', data);
            if (data.result === 'success') {
                form.reset(); // Clear the form fields
                if (typeof grecaptcha !== 'undefined') { grecaptcha.reset(); } // Reset reCAPTCHA
                responseMessage.textContent = 'Thank you! We have received your submission. We will contact you shortly.';
                responseMessage.className = 'response-message success';
            } else {
                 if (typeof grecaptcha !== 'undefined') { grecaptcha.reset(); } // Reset reCAPTCHA
                responseMessage.textContent = 'Submission Error: ' + (data.error || 'An unknown error occurred.');
                responseMessage.className = 'response-message error';
                console.error('Error reported by Apps Script:', data.error);
            }
        })
        .catch(error => {
            console.error('Submission Process Error:', error);
            if (typeof grecaptcha !== 'undefined') { grecaptcha.reset(); } // Reset reCAPTCHA
            // Provide more user-friendly messages based on error type
            let userErrorMessage = 'Submission Failed: An unexpected error occurred.';
            if (error.message.includes('Failed to fetch')) {
                userErrorMessage = 'Submission Failed: Please check your network connection and try again.';
            } else if (error.message.includes('Network response was not ok')) {
                 userErrorMessage = 'Submission Failed: The server could not process the request. Please try again later.';
                 console.error("Detailed Server Error Info:", error.message); // Log server text if available
            } else if (error.message.includes('JSON')) {
                 userErrorMessage = 'Submission Failed: Received an invalid response from the server.';
            }
            responseMessage.textContent = userErrorMessage;
            responseMessage.className = 'response-message error';
        })
        .finally(() => {
            // Re-enable button and restore state
            submitButton.disabled = false;
            buttonText.textContent = 'Submit Application';
            spinner.style.display = 'none';
            // Ensure response message is visible
            responseMessage.style.display = 'block';
        });
});

// Optional: Clear validation message when user starts typing in a field again
form.querySelectorAll('input[required], textarea[required]').forEach(input => {
    input.addEventListener('input', () => {
        const errorDiv = document.getElementById(input.id + 'Error');
        if (errorDiv && errorDiv.style.display === 'block') {
            errorDiv.textContent = '';
            errorDiv.style.display = 'none';
            input.removeAttribute('aria-invalid');
        }
    });
});

// *** NO EXTRA BRACE HERE ***
