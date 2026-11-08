namespace org.mozilla.intl.chardet;

public class nsGB2312Verifier : nsVerifier
{
	private static int[] m_cclass;

	private static int[] m_states;

	private static int m_stFactor;

	private static string m_charset;

	public override int[] cclass()
	{
		return m_cclass;
	}

	public override int[] states()
	{
		return m_states;
	}

	public override int stFactor()
	{
		return m_stFactor;
	}

	public override string charset()
	{
		return m_charset;
	}

	public nsGB2312Verifier()
	{
		m_cclass = new int[32];
		m_cclass[0] = 286331153;
		m_cclass[1] = 1118481;
		m_cclass[2] = 286331153;
		m_cclass[3] = 286327057;
		m_cclass[4] = 286331153;
		m_cclass[5] = 286331153;
		m_cclass[6] = 286331153;
		m_cclass[7] = 286331153;
		m_cclass[8] = 286331153;
		m_cclass[9] = 286331153;
		m_cclass[10] = 286331153;
		m_cclass[11] = 286331153;
		m_cclass[12] = 286331153;
		m_cclass[13] = 286331153;
		m_cclass[14] = 286331153;
		m_cclass[15] = 286331153;
		m_cclass[16] = 0;
		m_cclass[17] = 0;
		m_cclass[18] = 0;
		m_cclass[19] = 0;
		m_cclass[20] = 572662304;
		m_cclass[21] = 858993442;
		m_cclass[22] = 572662306;
		m_cclass[23] = 572662306;
		m_cclass[24] = 572662306;
		m_cclass[25] = 572662306;
		m_cclass[26] = 572662306;
		m_cclass[27] = 572662306;
		m_cclass[28] = 572662306;
		m_cclass[29] = 572662306;
		m_cclass[30] = 572662306;
		m_cclass[31] = 35791394;
		m_states = new int[2];
		m_states[0] = 286331649;
		m_states[1] = 1122850;
		m_charset = "GB2312";
		m_stFactor = 4;
	}

	public override bool isUCS2()
	{
		return false;
	}
}
