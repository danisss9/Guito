import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { WorkingReviewPage } from './app/components/working-review-page/working-review-page';

// The code review results open in a tab of their own on the same server.
const view = new URLSearchParams(window.location.search).get('guitoView');
const root = view === 'working-review' ? WorkingReviewPage : App;

bootstrapApplication(root, appConfig).catch((err) => console.error(err));
