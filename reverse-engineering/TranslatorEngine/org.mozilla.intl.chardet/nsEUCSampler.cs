using System;

namespace org.mozilla.intl.chardet;

public class nsEUCSampler
{
	private int mTotal;

	private int mThreshold = 200;

	private int mState;

	public int[] mFirstByteCnt = new int[94];

	public int[] mSecondByteCnt = new int[94];

	public float[] mFirstByteFreq = new float[94];

	public float[] mSecondByteFreq = new float[94];

	public nsEUCSampler()
	{
		Reset();
	}

	public void Reset()
	{
		mTotal = 0;
		mState = 0;
		for (int i = 0; i < 94; i++)
		{
			mFirstByteCnt[i] = (mSecondByteCnt[i] = 0);
		}
	}

	public bool EnoughData()
	{
		return mTotal > mThreshold;
	}

	public bool GetSomeData()
	{
		return mTotal > 1;
	}

	public bool Sample(byte[] aIn, int aLen)
	{
		if (mState == 1)
		{
			return false;
		}
		int num = 0;
		int num2 = 0;
		while (num2 < aLen && 1 != mState)
		{
			switch (mState)
			{
			case 0:
				if ((aIn[num] & 0x80) != 0)
				{
					if (255 == (0xFF & aIn[num]) || 161 > (0xFF & aIn[num]))
					{
						mState = 1;
						break;
					}
					mTotal++;
					mFirstByteCnt[(0xFF & aIn[num]) - 161]++;
					mState = 2;
				}
				break;
			case 2:
				if ((aIn[num] & 0x80) != 0)
				{
					if (255 == (0xFF & aIn[num]) || 161 > (0xFF & aIn[num]))
					{
						mState = 1;
						break;
					}
					mTotal++;
					mSecondByteCnt[(0xFF & aIn[num]) - 161]++;
					mState = 0;
				}
				else
				{
					mState = 1;
				}
				break;
			default:
				mState = 1;
				break;
			case 1:
				break;
			}
			num2++;
			num++;
		}
		return 1 != mState;
	}

	public void CalFreq()
	{
		for (int i = 0; i < 94; i++)
		{
			mFirstByteFreq[i] = (float)mFirstByteCnt[i] / (float)mTotal;
			mSecondByteFreq[i] = (float)mSecondByteCnt[i] / (float)mTotal;
		}
	}

	public float GetScore(float[] aFirstByteFreq, float aFirstByteWeight, float[] aSecondByteFreq, float aSecondByteWeight)
	{
		return aFirstByteWeight * GetScore(aFirstByteFreq, mFirstByteFreq) + aSecondByteWeight * GetScore(aSecondByteFreq, mSecondByteFreq);
	}

	public float GetScore(float[] array1, float[] array2)
	{
		float num = 0f;
		for (int i = 0; i < 94; i++)
		{
			float num2 = array1[i] - array2[i];
			num += num2 * num2;
		}
		return (float)Math.Sqrt(num) / 94f;
	}
}
