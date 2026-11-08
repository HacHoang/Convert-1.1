namespace org.mozilla.intl.chardet;

public abstract class nsPSMDetector
{
	public const int ALL = 0;

	public const int JAPANESE = 1;

	public const int CHINESE = 2;

	public const int SIMPLIFIED_CHINESE = 3;

	public const int TRADITIONAL_CHINESE = 4;

	public const int KOREAN = 5;

	public const int NO_OF_LANGUAGES = 6;

	public const int MAX_VERIFIERS = 16;

	private nsVerifier[] mVerifier;

	private nsEUCStatistics[] mStatisticsData;

	private nsEUCSampler mSampler = new nsEUCSampler();

	private byte[] mState = new byte[16];

	private int[] mItemIdx = new int[16];

	private int mItems;

	private int mClassItems;

	protected bool mDone;

	protected bool mRunSampler;

	protected bool mClassRunSampler;

	public nsPSMDetector()
	{
		initVerifiers(0);
		Reset();
	}

	public nsPSMDetector(int langFlag)
	{
		initVerifiers(langFlag);
		Reset();
	}

	public nsPSMDetector(int aItems, nsVerifier[] aVerifierSet, nsEUCStatistics[] aStatisticsSet)
	{
		mClassRunSampler = aStatisticsSet != null;
		mStatisticsData = aStatisticsSet;
		mVerifier = aVerifierSet;
		mClassItems = aItems;
		Reset();
	}

	public void Reset()
	{
		mRunSampler = mClassRunSampler;
		mDone = false;
		mItems = mClassItems;
		for (int i = 0; i < mItems; i++)
		{
			mState[i] = 0;
			mItemIdx[i] = i;
		}
		mSampler.Reset();
	}

	protected void initVerifiers(int currVerSet)
	{
		int num = ((currVerSet >= 0 && currVerSet < 6) ? currVerSet : 0);
		mVerifier = null;
		mStatisticsData = null;
		switch (num)
		{
		case 4:
			mVerifier = new nsVerifier[7]
			{
				new nsUTF8Verifier(),
				new nsBIG5Verifier(),
				new nsISO2022CNVerifier(),
				new nsEUCTWVerifier(),
				new nsCP1252Verifier(),
				new nsUCS2BEVerifier(),
				new nsUCS2LEVerifier()
			};
			mStatisticsData = new nsEUCStatistics[7]
			{
				null,
				new Big5Statistics(),
				null,
				new EUCTWStatistics(),
				null,
				null,
				null
			};
			break;
		case 5:
			mVerifier = new nsVerifier[6]
			{
				new nsUTF8Verifier(),
				new nsEUCKRVerifier(),
				new nsISO2022KRVerifier(),
				new nsCP1252Verifier(),
				new nsUCS2BEVerifier(),
				new nsUCS2LEVerifier()
			};
			break;
		case 3:
			mVerifier = new nsVerifier[8]
			{
				new nsUTF8Verifier(),
				new nsGB2312Verifier(),
				new nsGB18030Verifier(),
				new nsISO2022CNVerifier(),
				new nsHZVerifier(),
				new nsUCS2BEVerifier(),
				new nsUCS2LEVerifier(),
				new nsCP1252Verifier()
			};
			break;
		case 1:
			mVerifier = new nsVerifier[7]
			{
				new nsUTF8Verifier(),
				new nsSJISVerifier(),
				new nsEUCJPVerifier(),
				new nsISO2022JPVerifier(),
				new nsCP1252Verifier(),
				new nsUCS2BEVerifier(),
				new nsUCS2LEVerifier()
			};
			break;
		case 2:
			mVerifier = new nsVerifier[10]
			{
				new nsUTF8Verifier(),
				new nsGB2312Verifier(),
				new nsGB18030Verifier(),
				new nsBIG5Verifier(),
				new nsISO2022CNVerifier(),
				new nsHZVerifier(),
				new nsEUCTWVerifier(),
				new nsCP1252Verifier(),
				new nsUCS2BEVerifier(),
				new nsUCS2LEVerifier()
			};
			mStatisticsData = new nsEUCStatistics[10]
			{
				null,
				new GB2312Statistics(),
				null,
				new Big5Statistics(),
				null,
				null,
				new EUCTWStatistics(),
				null,
				null,
				null
			};
			break;
		case 0:
			mVerifier = new nsVerifier[15]
			{
				new nsUTF8Verifier(),
				new nsSJISVerifier(),
				new nsEUCJPVerifier(),
				new nsISO2022JPVerifier(),
				new nsEUCKRVerifier(),
				new nsISO2022KRVerifier(),
				new nsBIG5Verifier(),
				new nsEUCTWVerifier(),
				new nsGB2312Verifier(),
				new nsGB18030Verifier(),
				new nsISO2022CNVerifier(),
				new nsHZVerifier(),
				new nsCP1252Verifier(),
				new nsUCS2BEVerifier(),
				new nsUCS2LEVerifier()
			};
			mStatisticsData = new nsEUCStatistics[15]
			{
				null,
				null,
				new EUCJPStatistics(),
				null,
				new EUCKRStatistics(),
				null,
				new Big5Statistics(),
				new EUCTWStatistics(),
				new GB2312Statistics(),
				null,
				null,
				null,
				null,
				null,
				null
			};
			break;
		}
		mClassRunSampler = mStatisticsData != null;
		mClassItems = mVerifier.Length;
	}

	public abstract void Report(string charset);

	public bool HandleData(byte[] aBuf, int len)
	{
		for (int i = 0; i < len; i++)
		{
			byte b = aBuf[i];
			int num = 0;
			while (num < mItems)
			{
				byte nextState = nsVerifier.getNextState(mVerifier[mItemIdx[num]], b, mState[num]);
				switch (nextState)
				{
				case 2:
					Report(mVerifier[mItemIdx[num]].charset());
					mDone = true;
					return mDone;
				case 1:
					mItems--;
					if (num < mItems)
					{
						mItemIdx[num] = mItemIdx[mItems];
						mState[num] = mState[mItems];
					}
					break;
				default:
					mState[num++] = nextState;
					break;
				}
			}
			if (mItems <= 1)
			{
				if (1 == mItems)
				{
					Report(mVerifier[mItemIdx[0]].charset());
				}
				mDone = true;
				return mDone;
			}
			int num2 = 0;
			int num3 = 0;
			for (num = 0; num < mItems; num++)
			{
				if (!mVerifier[mItemIdx[num]].isUCS2() && !mVerifier[mItemIdx[num]].isUCS2())
				{
					num2++;
					num3 = num;
				}
			}
			if (1 == num2)
			{
				Report(mVerifier[mItemIdx[num3]].charset());
				mDone = true;
				return mDone;
			}
		}
		if (mRunSampler)
		{
			Sample(aBuf, len);
		}
		return mDone;
	}

	public void DataEnd()
	{
		if (mDone)
		{
			return;
		}
		if (mItems == 2)
		{
			if (mVerifier[mItemIdx[0]].charset() == "GB18030")
			{
				Report(mVerifier[mItemIdx[1]].charset());
				mDone = true;
			}
			else if (mVerifier[mItemIdx[1]].charset() == "GB18030")
			{
				Report(mVerifier[mItemIdx[0]].charset());
				mDone = true;
			}
		}
		if (mRunSampler)
		{
			Sample(null, 0, aLastChance: true);
		}
	}

	public void Sample(byte[] aBuf, int aLen)
	{
		Sample(aBuf, aLen, aLastChance: false);
	}

	public void Sample(byte[] aBuf, int aLen, bool aLastChance)
	{
		int num = 0;
		int num2 = 0;
		for (int i = 0; i < mItems; i++)
		{
			if (mStatisticsData[mItemIdx[i]] != null)
			{
				num2++;
			}
			if (!mVerifier[mItemIdx[i]].isUCS2() && !(mVerifier[mItemIdx[i]].charset() == "GB18030"))
			{
				num++;
			}
		}
		mRunSampler = num2 > 1;
		if (!mRunSampler)
		{
			return;
		}
		mRunSampler = mSampler.Sample(aBuf, aLen);
		if (((!aLastChance || !mSampler.GetSomeData()) && !mSampler.EnoughData()) || num2 != num)
		{
			return;
		}
		mSampler.CalFreq();
		int num3 = -1;
		int num4 = 0;
		float num5 = 0f;
		for (int i = 0; i < mItems; i++)
		{
			if (mStatisticsData[mItemIdx[i]] != null && !(mVerifier[mItemIdx[i]].charset() == "Big5"))
			{
				float score = mSampler.GetScore(mStatisticsData[mItemIdx[i]].mFirstByteFreq(), mStatisticsData[mItemIdx[i]].mFirstByteWeight(), mStatisticsData[mItemIdx[i]].mSecondByteFreq(), mStatisticsData[mItemIdx[i]].mSecondByteWeight());
				if (num4++ == 0 || num5 > score)
				{
					num5 = score;
					num3 = i;
				}
			}
		}
		if (num3 >= 0)
		{
			Report(mVerifier[mItemIdx[num3]].charset());
			mDone = true;
		}
	}

	public string[] getProbableCharsets()
	{
		if (mItems <= 0)
		{
			return new string[1] { "nomatch" };
		}
		string[] array = new string[mItems];
		for (int i = 0; i < mItems; i++)
		{
			array[i] = mVerifier[mItemIdx[i]].charset();
		}
		return array;
	}
}
