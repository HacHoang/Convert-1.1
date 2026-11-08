using org.mozilla.intl.chardet;

namespace TranslatorEngine;

public class Notifier : nsICharsetDetectionObserver
{
	public void Notify(string charset)
	{
		CharsetDetector.DetectedCharset = charset;
	}
}
