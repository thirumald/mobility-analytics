/* Map configuration. Leave geoapifyKey empty in git: the Pages workflow writes this file from the repository secret
   GEOAPIFY_KEY at deploy time, or paste a key in the browser (account menu → Map key). With no key the app uses CARTO tiles.
   A Geoapify key is browser-side and visible to site visitors, so restrict it to your site's domain in the Geoapify dashboard. */
window.SAFAR_CONFIG = { geoapifyKey: '' };
