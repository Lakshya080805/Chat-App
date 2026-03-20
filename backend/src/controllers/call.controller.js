export const getIceServers = async (req, res) => {
  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (!accountSid || !authToken) {
      return res.status(400).json({ message: "Twilio credentials not configured" });
    }

    const basicAuth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
    const tokenUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Tokens.json`;

    const twilioRes = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicAuth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(),
    });

    if (!twilioRes.ok) {
      const errorText = await twilioRes.text();
      console.error("Twilio ICE token error:", errorText);
      return res.status(502).json({ message: "Failed to fetch ICE servers from Twilio" });
    }

    const data = await twilioRes.json();
    const iceServers = Array.isArray(data.ice_servers) ? data.ice_servers : [];

    return res.status(200).json({ iceServers });
  } catch (error) {
    console.error("Error in getIceServers:", error.message);
    return res.status(500).json({ message: "Internal server error" });
  }
};
