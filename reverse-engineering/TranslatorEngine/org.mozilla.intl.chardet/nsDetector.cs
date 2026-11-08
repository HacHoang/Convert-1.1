namespace org.mozilla.intl.chardet;

public class nsDetector : nsPSMDetector, nsICharsetDetector
{
	private nsICharsetDetectionObserver mObserver;

	public nsDetector()
	{
	}

	public nsDetector(int langFlag)
		: base(langFlag)
	{
	}

	public void Init(nsICharsetDetectionObserver aObserver)
	{
		mObserver = aObserver;
	}

	public bool DoIt(byte[] aBuf, int aLen, bool oDontFeedMe)
	{
		if (aBuf == null || oDontFeedMe)
		{
			return false;
		}
		HandleData(aBuf, aLen);
		return mDone;
	}

	public void Done()
	{
		DataEnd();
	}

	public override void Report(string charset)
	{
		if (mObserver != null)
		{
			mObserver.Notify(charset);
		}
	}

	public bool isAscii(byte[] aBuf, int aLen)
	{
		for (int i = 0; i < aLen; i++)
		{
			if ((0x80 & aBuf[i]) != 0)
			{
				return false;
			}
		}
		return true;
	}
}
