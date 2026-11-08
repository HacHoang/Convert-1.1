namespace org.mozilla.intl.chardet;

public interface nsICharsetDetector
{
	void Init(nsICharsetDetectionObserver observer);

	bool DoIt(byte[] aBuf, int aLen, bool oDontFeedMe);

	void Done();
}
