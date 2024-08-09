# Sydney train disruption notifier 🚉

Sydney trains are the envy of the world. People come from all around to experience the thrill of having their morning train cancelled because there was a bit of drizzle and all the signals failed to cope with this unexpected turn of events.

However, sometimes one wishes to actually use Sydney's train system to get somewhere. "What madness!" you exclaim. And I cannot disagree, yet what is it to live in this world, if not madness?

And this, dear reader, is where the delays and cancellations go from being a charming affectation of our fine city to a source of misery and despair. To arrive at the station, ready to be transported to all manner of delightful places, only to discover that the train one intended to catch has been cruelly cancelled -- it's enough to make one scream into the air like a Klingon warrior honouring a fallen comrade, as startled strangers hurry past, avoiding eye contact.

Thus, this project was born. The **Sydney train disruption notifier** is a script that will use the Transport for NSW APIs to check one specific train service, and send a text message informing of its status: on time, delayed, or cancelled.

## Setup

The script relies on two services:

- [Transport for NSW Open Data](https://opendata.transport.nsw.gov.au/), which provides APIs for real-time transport information
- [Twilio](https://www.twilio.com/), for sending SMS messages

Set up accounts for each, and set up Twilio for sending SMS to you. Then fill in the environment variables.

Set up the script to run via cron whenever you want to be notified.
