async function registerUser(event) {
    event.preventDefault();

    const username = document.querySelector('input[name="username"]').value;
    const email = document.querySelector('input[name="email"]').value;
    const password = document.querySelector('input[name="password"]').value;

    const response = await fetch('/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password })
    });

    const result = await response.json();

    if (response.ok) {
        alert('Registration successful! You can now log in.');
        console.log('Registered successfully');
        window.location.href = '/index.html'; // Redirect til login
    } else {
        alert(`Registration failed: ${result.message}`);
        console.error('Registration error:', result.message);
    }
}