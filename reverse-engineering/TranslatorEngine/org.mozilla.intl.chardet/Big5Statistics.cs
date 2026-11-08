namespace org.mozilla.intl.chardet;

public class Big5Statistics : nsEUCStatistics
{
	private static float[] m_FirstByteFreq;

	private static float m_FirstByteStdDev;

	private static float m_FirstByteMean;

	private static float m_FirstByteWeight;

	private static float[] m_SecondByteFreq;

	private static float m_SecondByteStdDev;

	private static float m_SecondByteMean;

	private static float m_SecondByteWeight;

	public override float[] mFirstByteFreq()
	{
		return m_FirstByteFreq;
	}

	public override float mFirstByteStdDev()
	{
		return m_FirstByteStdDev;
	}

	public override float mFirstByteMean()
	{
		return m_FirstByteMean;
	}

	public override float mFirstByteWeight()
	{
		return m_FirstByteWeight;
	}

	public override float[] mSecondByteFreq()
	{
		return m_SecondByteFreq;
	}

	public override float mSecondByteStdDev()
	{
		return m_SecondByteStdDev;
	}

	public override float mSecondByteMean()
	{
		return m_SecondByteMean;
	}

	public override float mSecondByteWeight()
	{
		return m_SecondByteWeight;
	}

	public Big5Statistics()
	{
		m_FirstByteFreq = new float[94]
		{
			0f, 0f, 0f, 0.114427f, 0.061058f, 0.075598f, 0.048386f, 0.063966f, 0.027094f, 0.095787f,
			0.029525f, 0.031331f, 0.036915f, 0.021805f, 0.019349f, 0.037496f, 0.018068f, 0.01276f, 0.030053f, 0.017339f,
			0.016731f, 0.019501f, 0.01124f, 0.032973f, 0.016658f, 0.015872f, 0.021458f, 0.012378f, 0.017003f, 0.020802f,
			0.012454f, 0.009239f, 0.012829f, 0.007922f, 0.010079f, 0.009815f, 0.010104f, 0f, 0f, 0f,
			5.3E-05f, 3.5E-05f, 0.000105f, 3.1E-05f, 8.8E-05f, 2.7E-05f, 2.7E-05f, 2.6E-05f, 3.5E-05f, 2.4E-05f,
			3.4E-05f, 0.000375f, 2.5E-05f, 2.8E-05f, 2E-05f, 2.4E-05f, 2.8E-05f, 3.1E-05f, 5.9E-05f, 4E-05f,
			3E-05f, 7.9E-05f, 3.7E-05f, 4E-05f, 2.3E-05f, 3E-05f, 2.7E-05f, 6.4E-05f, 2E-05f, 2.7E-05f,
			2.5E-05f, 7.4E-05f, 1.9E-05f, 2.3E-05f, 2.1E-05f, 1.8E-05f, 1.7E-05f, 3.5E-05f, 2.1E-05f, 1.9E-05f,
			2.5E-05f, 1.7E-05f, 3.7E-05f, 1.8E-05f, 1.8E-05f, 1.9E-05f, 2.2E-05f, 3.3E-05f, 3.2E-05f, 0f,
			0f, 0f, 0f, 0f
		};
		m_FirstByteStdDev = 0.020606f;
		m_FirstByteMean = 0.010638f;
		m_FirstByteWeight = 0.675261f;
		m_SecondByteFreq = new float[94]
		{
			0.020256f, 0.003293f, 0.045811f, 0.01665f, 0.007066f, 0.004146f, 0.009229f, 0.007333f, 0.003296f, 0.005239f,
			0.008282f, 0.003791f, 0.006116f, 0.003536f, 0.004024f, 0.016654f, 0.009334f, 0.005429f, 0.033392f, 0.006121f,
			0.008983f, 0.002801f, 0.004221f, 0.010357f, 0.014695f, 0.077937f, 0.006314f, 0.00402f, 0.007331f, 0.00715f,
			0.005341f, 0.009195f, 0.00535f, 0.005698f, 0.004472f, 0.007242f, 0.004039f, 0.011154f, 0.016184f, 0.004741f,
			0.012814f, 0.007679f, 0.008045f, 0.016631f, 0.009451f, 0.016487f, 0.007287f, 0.012688f, 0.017421f, 0.013205f,
			0.03148f, 0.003404f, 0.009149f, 0.008921f, 0.007514f, 0.008683f, 0.008203f, 0.031403f, 0.011733f, 0.015617f,
			0.015306f, 0.004004f, 0.010899f, 0.009961f, 0.008388f, 0.01092f, 0.003925f, 0.008585f, 0.009108f, 0.015546f,
			0.004659f, 0.006934f, 0.007023f, 0.020252f, 0.005387f, 0.024704f, 0.006963f, 0.002625f, 0.009512f, 0.002971f,
			0.008233f, 0.01f, 0.011973f, 0.010553f, 0.005945f, 0.006349f, 0.009401f, 0.008577f, 0.008186f, 0.008159f,
			0.005033f, 0.008714f, 0.010614f, 0.006554f
		};
		m_SecondByteStdDev = 0.009909f;
		m_SecondByteMean = 0.010638f;
		m_SecondByteWeight = 0.324739f;
	}
}
