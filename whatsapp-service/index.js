const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const express = require('express');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

let isReady = false;

client.on('qr', (qr) => {
    isReady = false;
    console.log('--- SCAN THIS QR CODE WITH WHATSAPP ---');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    isReady = true;
    console.log('WhatsApp Client is READY!');
});

client.on('authenticated', () => {
    console.log('WhatsApp Authenticated!');
});

client.on('auth_failure', (msg) => {
    isReady = false;
    console.error('WhatsApp Authentication FAILURE:', msg);
});

client.on('disconnected', (reason) => {
    isReady = false;
    console.log('WhatsApp Client was DISCONNECTED:', reason);
});

client.on('change_state', (state) => {
    console.log('WhatsApp State Changed:', state);
    if (state === 'CONNECTED') {
        isReady = true;
    } else {
        isReady = false;
    }
});

app.get('/status', async (req, res) => {
    let health = isReady;
    
    if (isReady) {
        try {
            // Proactively check if the browser is still responsive
            await client.getState();
        } catch (e) {
            console.error('Health check failed:', e.message);
            isReady = false;
            health = false;
        }
    }
    
    res.json({ 
        ready: health,
        status: health ? 'CONNECTED' : 'DISCONNECTED/INITIALIZING'
    });
});

app.post('/send-message', async (req, res) => {
    const { phone, message } = req.body;
    console.log(`Attempting to send message to: ${phone}`);

    if (!isReady) {
        return res.status(503).json({ error: 'WhatsApp client is not ready. Please wait for the QR scan and "READY" message in terminal.' });
    }

    if (!phone || !message) {
        return res.status(400).json({ error: 'Phone and message are required' });
    }

    try {
        // Format phone number for whatsapp-web.js
        let formattedPhone = phone.replace(/\D/g, ''); // remove non-digits
        
        // Handle Pakistan local format (03xxxxxxxxx -> 923xxxxxxxxx)
        if (formattedPhone.startsWith('03') && formattedPhone.length === 11) {
            formattedPhone = '92' + formattedPhone.substring(1);
        }
        
        // Ensure it doesn't have leading zeros
        if (formattedPhone.startsWith('00')) {
            formattedPhone = formattedPhone.substring(2);
        }
        
        console.log(`Searching for WhatsApp ID for: ${formattedPhone}`);
        
        try {
            const jid = formattedPhone.includes('@c.us') ? formattedPhone : `${formattedPhone}@c.us`;
            let finalJid = jid;

            // Try to resolve the number ID (which handles LIDs and verifies registration)
            try {
                console.log(`Verifying if ${formattedPhone} is registered...`);
                const numberId = await client.getNumberId(formattedPhone);
                if (numberId) {
                    finalJid = numberId._serialized;
                    console.log(`Resolved JID: ${finalJid}`);
                } else {
                    console.log(`getNumberId returned null for ${formattedPhone}. Checking isRegisteredUser as fallback...`);
                    // We try isRegisteredUser as a fallback. 
                    // Some numbers (especially recently added ones) might return null on getNumberId but true on isRegisteredUser
                    const isRegistered = await client.isRegisteredUser(jid);
                    console.log(`isRegisteredUser result: ${isRegistered}`);
                    if (!isRegistered) {
                        console.log(`Number ${formattedPhone} is not registered on WhatsApp.`);
                        return res.status(404).json({ error: 'Number not registered on WhatsApp' });
                    }
                    // If isRegistered is true but numberId was null, we use the default JID
                    console.log(`Number is registered, proceeding with default JID: ${finalJid}`);
                }
            } catch (err) {
                console.log(`Registration check error: ${err.message}, proceeding with ${finalJid}`);
            }

            // Attempt to send message using a robust multi-step approach
            console.log(`Sending message to ${finalJid}...`);
            
            try {
                // Step 1: Resolve contact to ensure LID is loaded internally
                const contact = await client.getContactById(finalJid);
                const resolvedJid = contact.id._serialized;
                
                // Step 2: Small delay to allow internal state to update
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                // Step 3: Send message
                const response = await client.sendMessage(resolvedJid, message);
                console.log('Message sent successfully!');
                res.json({ success: true, response });
            } catch (sendError) {
                console.log(`Primary send method failed: ${sendError.message}. Trying direct fallback...`);
                const response = await client.sendMessage(finalJid, message);
                console.log('Message sent successfully via fallback!');
                res.json({ success: true, response });
            }
        } catch (innerError) {
            console.error('All sending attempts failed:', innerError);
            
            // Handle specific Puppeteer/Browser errors
            if (innerError.message.includes('detached Frame') || innerError.message.includes('Session closed')) {
                isReady = false; // Mark as not ready so user knows something is wrong
                return res.status(503).json({ 
                    error: 'WhatsApp connection unstable', 
                    details: 'The browser session was interrupted (Detached Frame). Please wait a moment for it to reconnect or restart the service.',
                    suggestion: 'Restarting the node index.js process usually fixes this.'
                });
            }

            res.status(500).json({ 
                error: 'Failed to send message', 
                details: innerError.message,
                suggestion: 'The number might be invalid or there is a connection issue.'
            });
        }
    } catch (error) {
        console.error('Failed to send message:', error);
        res.status(500).json({ error: 'Failed to send message', details: error.message });
    }
});

const PORT = 3001;
app.listen(PORT, () => {
    console.log(`WhatsApp Bridge API running on http://localhost:${PORT}`);
    client.initialize();
});
