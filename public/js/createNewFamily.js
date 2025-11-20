document.addEventListener('DOMContentLoaded', () => {
    const createButton = document.getElementById('createFamilyBtn');
    const errorMessage = document.getElementById('errorMessage');

    createButton.addEventListener('click', async () => {
        errorMessage.textContent = ''; // fjern tidligere feilmeldinger


        const familyName = prompt('Please enter a name for your new family:');

        // Bare gå videre om brukeren har oppgitt et navn til gruppen
        if (familyName) {
            try {
                const response = await fetch('/createFamily', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ familyName }),
                });

                const result = await response.json();

                if (response.ok) {
                    // Ved suksess, omdiriger til dashbordet
                    window.location.href = result.redirectUrl;
                } else {
                    // Vis feilmelding fra serveren
                    errorMessage.textContent = result.message || 'An unknown error occurred.';
                }
            } catch (error) {
                console.error('Error creating family:', error);
                errorMessage.textContent = 'A network error occurred. Please try again.';
            }
        }
        // Hvis brukeren klikker "Avbryt" eller lar prompten være tom, skjer ingenting.
    });
});