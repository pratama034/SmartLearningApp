package com.smartlearning.app

import com.smartlearning.focus.FocusNotificationListener as BaseFocusNotificationListener

/**
 * Subclass in com.smartlearning.app package ensuring that whether the manifest specifies
 * relative name ".FocusNotificationListener" (which expands to com.smartlearning.app.FocusNotificationListener)
 * or fully-qualified name "com.smartlearning.focus.FocusNotificationListener", Android OS will find a valid class.
 */
class FocusNotificationListener : BaseFocusNotificationListener()

