document.addEventListener('DOMContentLoaded', () => {

    const joinButton = document.getElementById('joinFamilyBtn'); 
    const messageElement = document.getElementById('joinMessage');

    if (joinButton) {
        joinButton.addEventListener('click', async () => {
            // fjern eventuelle tidligere meldinger
            showMessage('', 'neutral');

            // 1. Use a prompt to ask for the join code
            const joinCode = prompt('Please enter the family join code:');

            // 2. Bare gå videre hvis brukeren skrev inn en kode
            if (joinCode && joinCode.trim() !== '') {
                try {
                    const response = await fetch('/join-request', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ joinCode: joinCode.trim() }),
                    });

                    const result = await response.json();

                    if (response.ok) {
                            // Ved suksess, vis suksessmeldingen fra serveren
                            showMessage(result.message, 'success');
                    } else {
                        // Ved feil, vis feilmeldingen fra serveren
                        showMessage(result.message || 'An unknown error occurred.', 'error');
                    }
                } catch (error) {
                    console.error('Error sending join request:', error);
                    showMessage('A network error occurred. Please try again.', 'error');
                }
            }
            // Om brukeren avbryter prompten eller ikke skriver noe, så skjer ingenting
        });
    }

    function showMessage(message, type) {
        if (messageElement) {
            messageElement.textContent = message;
            messageElement.className = `message ${type}`;
        }
    }
});