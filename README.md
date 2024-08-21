# Sydney train disruption notifier 🚉

Sydney trains are the envy of the world. People come from all around to experience the thrill of having their morning train cancelled because there was a bit of drizzle and all the signals failed to cope with this unexpected turn of events.

However, sometimes one wishes to actually use Sydney's train system to get somewhere. "What madness!" you exclaim. And I cannot disagree, yet what is it to live in this world, if not madness?

And this, dear reader, is where the delays and cancellations go from being a charming affectation of our fine city to a source of misery and despair. To arrive at the station, ready to be transported to all manner of delightful places, only to discover that the train one intended to catch has been cruelly cancelled -- it's enough to make one scream into the air like a Klingon warrior honouring a fallen comrade, as startled strangers hurry past, avoiding eye contact.

Thus, this project was born. The **Sydney train disruption notifier** is a script that will use the Transport for NSW APIs to check one specific train service, and send a text message informing of its status: on time, delayed, or cancelled.

## Setup

The script relies on [Transport for NSW Open Data](https://opendata.transport.nsw.gov.au/), which provides APIs for real-time transport information.

There are two options for notifications:
- SMS via [Twilio](https://www.twilio.com/)
- Push notifications via [NotifyDroid](https://play.google.com/store/apps/details?id=net.xdroid.pn)

Set up an account for Open Data (and Twilio if you're using it). Then fill in the environment variables.

To find the appropriate value for the `ROUTE_PREFIX` variable, look at `routes.txt` in the GTFS data (automatically downloaded when you run the script), and find a prefix that covers the routes you're interested in. For example, if you're going from Newcastle to Central then you'll want either the CCN_2a or CCN_2b route, in which case you'd use the prefix `CCN_2` to cover both routes. But if you're going from Newcastle to Strathfield, you would use `CCN_2a` to get just the route that goes via Strathfield.

Similarly, use `stops.txt` to ensure that your `STATION_NAME` variable matches the name for that station in the file. It only has to match a substring, so for example `Sydenham Station` will match any platform at Sydenham, but you could use a more specific value e.g. `Sydenham Station Platform 4`, if you only want notifications about trains on that platform.

Run with `yarn start`.

Set up the script to run via cron whenever you want to be notified.
