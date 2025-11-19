async function loginUser(event) {
    event.preventDefault();

    const email = document.querySelector('input[name="email"]').value;
    const password = document.querySelector('input[name="password"]').value;

    const response = await fetch('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    });

    const result = await response.json();

    if (response.ok) {
        alert('Login successful!');
        console.log('Logged in successfully');
        window.location.href = result.redirectUrl; // Redirect basert på serverens svar
    } else {
        alert(`Login failed: ${result.message}`);
        console.error('Login error:', result.message);
    }
}