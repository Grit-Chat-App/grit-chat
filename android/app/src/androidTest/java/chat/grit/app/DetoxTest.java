package chat.grit.app;

import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.filters.LargeTest;
import androidx.test.rule.ActivityTestRule;

import com.wix.detox.Detox;
import com.wix.detox.config.DetoxConfig;

import org.junit.Rule;
import org.junit.Test;
import org.junit.runner.RunWith;

/**
 * The Android instrumentation entry point Detox drives. There is no Android test source set in this
 * lineage before this file: the whole suite has only ever run on an iOS simulator.
 *
 * <p>This follows the contract of the installed Detox, version 20.28.0 (node_modules/detox/package.json).
 * The shape is taken from that version's own documentation and source, not from memory:</p>
 *
 * <ul>
 *   <li>node_modules/detox/android/detox/src/full/java/com/wix/detox/Detox.java, javadoc lines 12 to 64:
 *       the usage example (AndroidJUnit4 + LargeTest + an ActivityTestRule for the activity that hosts
 *       React Native + a single test calling Detox.runTests), the requirement to run under
 *       AndroidJUnitRunner because Detox works through Espresso, and the note that detoxServer and
 *       detoxSessionId are supplied automatically by the `detox test` CLI. Without them the test is a
 *       no-op rather than a failure, which is why a green instrumentation run alone proves nothing.</li>
 *   <li>node_modules/detox/android/detox/src/full/java/com/wix/detox/config/DetoxConfig.kt and
 *       DetoxIdlePolicyConfig.kt: the two settable fields used below and their defaults
 *       (masterTimeoutSec 240, idleResourceTimeoutSec 180, rnContextLoadTimeoutSec 60).</li>
 *   <li>node_modules/detox/android/detox/src/full/java/com/wix/detox/ActivityLaunchHelper.kt: Detox
 *       builds the launch intent itself and calls activityTestRule.launchActivity(intent).</li>
 * </ul>
 *
 * <p>MainActivity is the launcher activity declared in AndroidManifest.xml and the ReactActivity that
 * hosts the "GritChat" component. MainApplication implements ReactApplication, so the plain
 * runTests(rule, config) overload applies; the explicit-context overload is for apps that do not.</p>
 */
@RunWith(AndroidJUnit4.class)
@LargeTest
public class DetoxTest {

    /**
     * launchActivity is false (the third constructor argument) on purpose. Detox launches the activity
     * itself from DetoxMain.run via ActivityLaunchHelper.launchActivityUnderTest(), and the intent it
     * builds there carries Detox's own launchArgs bundle plus any url or notification override. Letting
     * the rule auto-launch would put an activity on screen before Detox ever built that intent, so every
     * launch argument and deep link would be dropped and Detox would then be driving a screen it did not
     * start.
     *
     * <p>ActivityTestRule is deprecated in androidx, and it is still exactly what Detox 20.28.0 accepts:
     * every Detox.runTests overload takes an ActivityTestRule. Swapping in ActivityScenarioRule would not
     * compile against this version.</p>
     */
    @Rule
    public ActivityTestRule<MainActivity> mActivityRule =
            new ActivityTestRule<>(MainActivity.class, false, false);

    @Test
    public void runDetoxTests() {
        DetoxConfig detoxConfig = new DetoxConfig();
        // Espresso's idle policy. Left at Detox's own defaults, stated here rather than left implicit so
        // that raising them later is a visible edit instead of a silent divergence from the iOS timings.
        detoxConfig.idlePolicyConfig.masterTimeoutSec = 240;
        detoxConfig.idlePolicyConfig.idleResourceTimeoutSec = 180;
        // Detox's default of 60 seconds is for release bundles. This configuration is debug only (the
        // detox build command in .detoxrc.js is assembleDebug), so the first launch of every scenario
        // waits on Metro serving and evaluating the bundle. 180 is the value Detox's own project setup
        // documents for a debug build.
        detoxConfig.rnContextLoadTimeoutSec = 180;

        Detox.runTests(mActivityRule, detoxConfig);
    }
}
